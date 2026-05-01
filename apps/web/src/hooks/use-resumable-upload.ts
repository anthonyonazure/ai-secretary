/**
 * Hook surface for resumable chunked uploads. Returns a stable callable
 * that takes a recording blob and walks it through:
 *   1. Persist a `PersistedUploadSession` to IndexedDB so a tab close
 *      mid-flight doesn't lose data.
 *   2. Hand to `uploadBlobInChunks` with the configured retry policy.
 *   3. Drop the queue entry on success; mark `failed` on terminal errors.
 *
 * Story 4.5 plugs in:
 *   - 10-min wall-clock retry budget (default `RETRY_BUDGET_MS`).
 *     Exponential backoff capped at 30s; on every PUT failure we check
 *     `Date.now() - firstFailureAt > retryBudgetMs` — exhaustion fires
 *     `onBudgetExhausted` and rethrows a tagged `UploadBudgetExhaustedError`
 *     so the recording-controller can transition the FSM to `error` with
 *     `reason: 'upload-retry-exhausted', retryable: true`.
 *   - The "user-tap retry-now" entrypoint resets the per-upload state by
 *     re-invoking `upload(...)`; each invocation starts a fresh budget
 *     window.
 *
 * Story 2.1 wired the real presigned-URL pipeline: the recording
 * controller constructs a `PresignedPosterController` (see
 * `lib/recording/presigned-poster.ts`) and passes its `.poster` here as
 * the `poster` injection point. The fallback fetch-poster from Story
 * 4.2 has been removed.
 */

import { useCallback, useRef } from 'react';
import {
  type ChunkPoster,
  type ChunkUploadResult,
  type RetryPolicy,
  uploadBlobInChunks,
} from '../lib/recording/chunk-uploader';
import {
  type PersistedUploadSession,
  dequeueUpload,
  enqueueUpload,
  isQueueAvailable,
  updateUpload,
} from '../lib/recording/upload-queue-store';

/** 10 minutes — arch-addendums § 6 silent-retry budget. */
export const RETRY_BUDGET_MS = 10 * 60 * 1000;
/** Backoff floor: 1s — first retry never undercuts this. */
export const RETRY_BACKOFF_FLOOR_MS = 1_000;
/** Backoff ceiling: 30s — never sleep longer than this between attempts. */
export const RETRY_BACKOFF_CAP_MS = 30_000;

/**
 * Tagged error thrown when the budget elapses. The recording controller
 * narrows on `error.name === 'UploadBudgetExhaustedError'` to drive the
 * `upload-retry-exhausted` FSM transition.
 */
export class UploadBudgetExhaustedError extends Error {
  override readonly name = 'UploadBudgetExhaustedError';
  constructor(
    public readonly recordingId: string,
    override readonly cause: unknown,
  ) {
    super('Upload retry budget exhausted');
  }
}

export interface ResumableUploadParams {
  recordingId: string;
  uploadId: string;
  blob: Blob;
  mimeType: string;
}

export interface UseResumableUploadOptions {
  /**
   * Required injection point for the chunk PUT. Production wiring
   * builds a `PresignedPosterController` and passes
   * `controller.poster`; tests pass a mock.
   */
  poster: ChunkPoster;
  /**
   * Optional override for the per-chunk retry policy used by the
   * underlying chunk-uploader. The 10-min outer budget is enforced by
   * this hook; this parameter only affects per-chunk attempt count +
   * backoff curve.
   */
  retryPolicy?: RetryPolicy;
  /**
   * Wall-clock budget for the upload, in ms. Defaults to
   * `RETRY_BUDGET_MS` (10 min). When the elapsed time since the first
   * failure exceeds this, `upload(...)` throws
   * `UploadBudgetExhaustedError` and `onBudgetExhausted` fires.
   */
  retryBudgetMs?: number;
  /**
   * Optional callback invoked when the budget is exhausted. The
   * recording-controller wires this to its FSM transition.
   */
  onBudgetExhausted?: (input: { recordingId: string; lastError: Error }) => void;
  onProgress?: (fraction: number) => void;
  /** Optional sleep injection — defaults to setTimeout. Tests pass a no-op. */
  sleep?: (ms: number) => Promise<void>;
  /** Optional clock — defaults to Date.now. Tests pin time for deterministic budget math. */
  now?: () => number;
}

export interface ResumableUploadResult {
  /** Per-chunk results — `partNumber = chunkIndex + 1`. Caller passes
   * these to the presigned-poster's `complete()` step. */
  parts: ChunkUploadResult[];
}

export interface UseResumableUploadApi {
  upload: (params: ResumableUploadParams) => Promise<ResumableUploadResult>;
  cancel: () => void;
}

/**
 * Wraps `poster` with the 10-min wall-clock retry budget. On the first
 * failure we record `firstFailureAt`. Subsequent failures sleep with
 * exponential backoff (capped at 30s); if the next attempt would
 * exceed the budget, we rethrow `UploadBudgetExhaustedError`.
 *
 * The inner chunk-uploader's per-chunk retry policy still applies —
 * but we set its `maxAttempts` to 1 (single try per outer attempt) so
 * the budget logic owns the retry decision. Tests verifying the budget
 * pass `maxAttempts: 1` explicitly.
 *
 * Exported (not just internal) so vitest under node can drive it
 * directly without mounting the React hook.
 */
export const wrapPosterWithBudget = (deps: {
  poster: ChunkPoster;
  recordingId: string;
  retryBudgetMs: number;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}): ChunkPoster => {
  let firstFailureAt: number | null = null;
  let attempt = 0;
  return async (envelope, signal) => {
    while (true) {
      try {
        const result = await deps.poster(envelope, signal);
        // Successful chunk → clear failure tracking (next chunk gets a fresh budget).
        firstFailureAt = null;
        attempt = 0;
        return result;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        if (firstFailureAt === null) {
          firstFailureAt = deps.now();
        }
        const elapsed = deps.now() - firstFailureAt;
        if (elapsed >= deps.retryBudgetMs) {
          throw new UploadBudgetExhaustedError(deps.recordingId, err);
        }
        const backoff = Math.min(
          Math.max(RETRY_BACKOFF_FLOOR_MS * 2 ** attempt, RETRY_BACKOFF_FLOOR_MS),
          RETRY_BACKOFF_CAP_MS,
        );
        attempt += 1;
        // Cap the sleep so we never blow past the budget — if the
        // budget has 5s left, don't sleep 30s.
        const remaining = deps.retryBudgetMs - elapsed;
        await deps.sleep(Math.min(backoff, remaining));
      }
    }
  };
};

export function useResumableUpload(options: UseResumableUploadOptions): UseResumableUploadApi {
  const abortRef = useRef<AbortController | null>(null);
  const poster = options.poster;

  const upload = useCallback(
    async (params: ResumableUploadParams) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const retryBudgetMs = options.retryBudgetMs ?? RETRY_BUDGET_MS;
      const sleep =
        options.sleep ?? ((ms: number) => new Promise<void>((res) => setTimeout(res, ms)));
      const now = options.now ?? Date.now;

      const session: PersistedUploadSession = {
        id: params.uploadId,
        recordingId: params.recordingId,
        uploadId: params.uploadId,
        // `endpoint` is retained on the persisted session for backwards
        // compat with the IndexedDB schema (Story 4.2). With Story 2.1
        // it's now informational — the real per-chunk URLs are fetched
        // on demand by the presigned poster.
        endpoint: 'presigned-url',
        mimeType: params.mimeType,
        blob: params.blob,
        totalBytes: params.blob.size,
        lastAckedChunkIndex: -1,
        retryAttempts: 0,
        budgetStartedAt: now(),
        createdAt: now(),
        updatedAt: now(),
        status: 'uploading',
      };

      const queueOk = await isQueueAvailable();
      if (queueOk) await enqueueUpload(session);

      // The chunk-uploader runs its own per-chunk retry; we override
      // it with `maxAttempts: 1` so the budget wrapper is the single
      // source of truth for retry decisions. Callers that pass an
      // explicit `retryPolicy` get their setting honored — the budget
      // wrapper still runs on top.
      const innerRetry: RetryPolicy = options.retryPolicy ?? {
        maxAttempts: 1,
        backoffMs: () => 0,
      };

      const wrappedPoster = wrapPosterWithBudget({
        poster,
        recordingId: params.recordingId,
        retryBudgetMs,
        sleep,
        now,
      });

      try {
        const parts = await uploadBlobInChunks({
          recordingId: params.recordingId,
          uploadId: params.uploadId,
          blob: params.blob,
          mimeType: params.mimeType,
          poster: wrappedPoster,
          retry: innerRetry,
          signal: controller.signal,
          onProgress: (fraction) => {
            options.onProgress?.(fraction);
            if (queueOk) {
              void updateUpload(params.uploadId, {
                lastAckedChunkIndex: Math.floor(fraction * 1000),
              });
            }
          },
        });
        if (queueOk) await dequeueUpload(params.uploadId);
        return { parts };
      } catch (err) {
        if (queueOk) {
          await updateUpload(params.uploadId, { status: 'failed' });
        }
        if (err instanceof UploadBudgetExhaustedError) {
          // The on-device queue entry stays put — recording-controller
          // is responsible for reading it and offering a manual retry.
          options.onBudgetExhausted?.({
            recordingId: params.recordingId,
            lastError: err.cause instanceof Error ? err.cause : new Error(String(err.cause)),
          });
        }
        throw err;
      }
    },
    [poster, options],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { upload, cancel };
}
