/**
 * Mobile resumable upload — schedules the chunk walk via expo-task-manager
 * so it survives backgrounding and can resume on app foreground (per
 * arch-addendums § 6 + Story 4.5). The TaskManager registration itself
 * is a no-op until a task definition is registered at module load — see
 * `app/_layout.tsx`.
 *
 * Story 4.5 — 10-min wall-clock retry budget. Same shape as the web
 * mirror in `apps/web/src/hooks/use-resumable-upload.ts`. When the
 * budget elapses we throw `UploadBudgetExhaustedError` and fire
 * `onBudgetExhausted`; the recording-controller wires that to the
 * FSM's `error` state with `reason: 'upload-retry-exhausted'`.
 *
 * Story 2.1 wired the real presigned-URL pipeline: the recording
 * controller passes a `PresignedPosterController.poster` as the
 * `poster` injection point. The Story-4.2 fallback fetch-poster
 * has been removed.
 */

import * as FileSystem from 'expo-file-system';
import { useCallback, useRef } from 'react';
import {
  type ChunkPoster,
  type ChunkSource,
  type ChunkUploadResult,
  type RetryPolicy,
  uploadSourceInChunks,
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
export const RETRY_BACKOFF_FLOOR_MS = 1_000;
export const RETRY_BACKOFF_CAP_MS = 30_000;

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
  fileUri: string;
  mimeType: string;
}

export interface UseResumableUploadOptions {
  /** Required: the presigned-poster's chunk PUT function. */
  poster: ChunkPoster;
  retryPolicy?: RetryPolicy;
  /** 10-min wall-clock budget (default RETRY_BUDGET_MS). */
  retryBudgetMs?: number;
  onBudgetExhausted?: (input: { recordingId: string; lastError: Error }) => void;
  onProgress?: (fraction: number) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** Exported for unit tests (vitest under RN cannot mount the hook). */
export const wrapPosterWithBudget = (deps: {
  poster: ChunkPoster;
  recordingId: string;
  retryBudgetMs: number;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}): ChunkPoster => {
  let firstFailureAt: number | null = null;
  let attempt = 0;
  return async (envelope) => {
    while (true) {
      try {
        const result = await deps.poster(envelope);
        firstFailureAt = null;
        attempt = 0;
        return result;
      } catch (err) {
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
        const remaining = deps.retryBudgetMs - elapsed;
        await deps.sleep(Math.min(backoff, remaining));
      }
    }
  };
};

export interface ResumableUploadResult {
  parts: ChunkUploadResult[];
}

export interface UseResumableUploadApi {
  upload: (params: ResumableUploadParams) => Promise<ResumableUploadResult>;
  cancel: () => void;
}

export function useResumableUpload(options: UseResumableUploadOptions): UseResumableUploadApi {
  const cancelledRef = useRef<boolean>(false);
  const poster = options.poster;

  const upload = useCallback(
    async (params: ResumableUploadParams) => {
      cancelledRef.current = false;
      const retryBudgetMs = options.retryBudgetMs ?? RETRY_BUDGET_MS;
      const sleep =
        options.sleep ?? ((ms: number) => new Promise<void>((res) => setTimeout(res, ms)));
      const now = options.now ?? Date.now;

      const info = await FileSystem.getInfoAsync(params.fileUri, { size: true });
      if (!info.exists) {
        throw new Error(`Recording file missing at ${params.fileUri}`);
      }
      const totalBytes = (info as { size?: number }).size ?? 0;

      const session: PersistedUploadSession = {
        id: params.uploadId,
        recordingId: params.recordingId,
        uploadId: params.uploadId,
        endpoint: 'presigned-url',
        mimeType: params.mimeType,
        fileUri: params.fileUri,
        totalBytes,
        lastAckedChunkIndex: -1,
        retryAttempts: 0,
        budgetStartedAt: now(),
        createdAt: now(),
        updatedAt: now(),
        status: 'uploading',
      };

      const queueOk = await isQueueAvailable();
      if (queueOk) await enqueueUpload(session);

      const source: ChunkSource = {
        totalSize: totalBytes,
        readSlice: async (range) => {
          if (cancelledRef.current) {
            throw new Error('Upload cancelled');
          }
          return FileSystem.readAsStringAsync(params.fileUri, {
            encoding: FileSystem.EncodingType.Base64,
            position: range.start,
            length: range.end - range.start,
          });
        },
      };

      // The chunk-uploader's per-chunk retry is overridden to a
      // single-attempt policy; the budget wrapper owns retry.
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
        const parts = await uploadSourceInChunks({
          recordingId: params.recordingId,
          uploadId: params.uploadId,
          source,
          mimeType: params.mimeType,
          poster: wrappedPoster,
          retry: innerRetry,
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
    cancelledRef.current = true;
  }, []);

  return { upload, cancel };
}
