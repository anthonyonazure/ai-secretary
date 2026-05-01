/**
 * `transcribe` queue handler — Story 2.2 (real transcription engine).
 *
 * Lifecycle (FSM):
 *
 *   uploaded → transcribing → completed
 *                          \→ failed (with failure_reason)
 *
 *   - Idempotent re-run: if the row is already `transcribing` or `completed`
 *     the handler logs + returns. Re-firing the queue (e.g. pg-boss retry
 *     after a worker crash mid-flight) does not double-write speaker_turns.
 *
 * Steps:
 *   1. Validate payload (zod).
 *   2. Inside withJobContext:
 *      a. Read the recording row + the tenant row (compliancePosture +
 *         region) — region is also passed in the job payload as a sanity
 *         check; mismatches throw.
 *      b. Mark `recordings.status = 'transcribing'`.
 *      c. Generate a presigned-GET URL via the injected StorageProvider.
 *      d. Pick the engine kind via `selectProviderKindForTenant`.
 *      e. Build a real provider via the injected `transcriptionFactory`.
 *         If the configured engine lacks env credentials, fall back to
 *         a `MockTranscriptionProvider` and log a warning (dev/CI).
 *      f. Call `provider.transcribe(...)`.
 *      g. Map segments → `speaker_turns` rows via `computeTurnId(...)`.
 *      h. Insert all rows in a single transaction (already nested inside
 *         withJobContext's tx).
 *      i. Mark `recordings.status = 'completed'` + `transcribed_at`.
 *   3. On any TranscriptionError, mark `recordings.status = 'failed'`
 *      with `failure_reason` and rethrow so pg-boss records the failure.
 *
 * Diarization: OUT OF SCOPE for Story 2.2. Every inserted speaker_turn
 * row has `speaker = null`. Story 2.3 adds a Pyannote post-pass.
 *
 * Worker-side audit logger: not yet wired. See the TODO marker below;
 * Story 1.4 follow-up will introduce a worker counterpart to the API's
 * `audit-logger` plugin.
 */

import type { Db, Region } from '@aisecretary/db';
import { computeTurnId } from '@aisecretary/db/lib/speaker-turn-id';
import { recordings, speakerTurns, tenants } from '@aisecretary/db/schema';
import type { StorageProvider } from '@aisecretary/storage';
import {
  type CreateTranscriptionProviderConfig,
  type DiarizationProvider,
  MockTranscriptionProvider,
  type TenantTranscriptionContext,
  TranscriptionError,
  type TranscriptionProvider,
  type TranscriptionSegment,
  mergeDiarization,
  selectDiarizationStrategy,
  selectProviderKindForTenant,
} from '@aisecretary/transcription';
import { and, eq } from 'drizzle-orm';
import type pino from 'pino';
import { z } from 'zod';
import { withJobContext } from '../lib/job-context.js';

export const transcribeJobPayloadSchema = z.object({
  recordingId: z.string().uuid(),
  tenantId: z.string().uuid(),
  region: z.enum(['us', 'eu']),
});
export type TranscribeJobPayload = z.infer<typeof transcribeJobPayloadSchema>;

/** Minimal job envelope — pg-boss's `Job<T>` shape; we only need `data`. */
export interface TranscribeJob {
  data: TranscribeJobPayload;
}

/**
 * Factory signature — accepts the same `opts` shape as
 * `createTranscriptionProvider` from `@aisecretary/transcription`.
 * Tests inject a custom factory that returns a `MockTranscriptionProvider`
 * instead of touching the real openai SDK or a self-hosted endpoint.
 */
export type TranscriptionFactory = (
  opts: CreateTranscriptionProviderConfig,
) => TranscriptionProvider;

/**
 * Analysis-enqueuer seam — Story 3.2 + 3.3 wire the transcribe handler
 * to fan out into the summarize + extract-action-items queues on
 * completion. Production binds this to pg-boss's `boss.send(...)`;
 * tests inject an in-memory capture so they can assert what was
 * enqueued without booting a queue.
 */
export interface AnalysisEnqueuer {
  enqueueSummarize(payload: {
    meetingId: string;
    tenantId: string;
    region: Region;
  }): Promise<void>;
  enqueueActionItems(payload: {
    meetingId: string;
    tenantId: string;
    region: Region;
  }): Promise<void>;
}

export interface TranscribeHandlerDeps {
  db: Db;
  storage: StorageProvider;
  logger: pino.Logger;
  /** Default: `createTranscriptionProvider` from @aisecretary/transcription. */
  transcriptionFactory: TranscriptionFactory;
  /**
   * Story 2.4 — diarization provider. When present AND the engine kind
   * needs the post-pass (whisper-api), the handler runs diarization
   * after transcription and merges speaker labels onto segments before
   * persisting to `speaker_turns`. When omitted, segments persist with
   * `speaker: null` (back-compat with Story 2.2 behavior).
   *
   * Production wires `PyannoteHttpDiarizationProvider` against the
   * per-region container; tests inject a `MockDiarizationProvider`.
   */
  diarizationProvider?: DiarizationProvider;
  /**
   * Optional — when present, the handler enqueues `meeting.summarize`
   * + `meeting.action-items` jobs on the happy path. Omit (or set to
   * undefined) in tests that don't want to assert enqueue behavior.
   */
  analysisEnqueuer?: AnalysisEnqueuer;
  env: {
    OPENAI_API_KEY?: string;
    FASTER_WHISPER_URL?: string;
    /** Per-call timeout override (mostly used by tests). */
    TRANSCRIBE_TIMEOUT_MS?: number;
  };
}

const PRESIGN_GET_EXPIRY_SECONDS = 15 * 60;

/** Build a transcription provider, falling back to a mock when env is unset. */
const buildProvider = (
  deps: Pick<TranscribeHandlerDeps, 'transcriptionFactory' | 'env' | 'logger'>,
  ctx: TenantTranscriptionContext,
  tenantId: string,
): TranscriptionProvider => {
  const kind = selectProviderKindForTenant(ctx);
  const { env, logger, transcriptionFactory } = deps;

  if (kind === 'whisper-api' && !env.OPENAI_API_KEY) {
    logger.warn(
      { tenantId, kind, reason: 'OPENAI_API_KEY missing' },
      'transcribe: falling back to MockTranscriptionProvider',
    );
    return MockTranscriptionProvider.fromText(
      'Mock transcription — OPENAI_API_KEY not configured.',
      30_000,
    );
  }
  if (kind === 'faster-whisper' && !env.FASTER_WHISPER_URL) {
    logger.warn(
      { tenantId, kind, reason: 'FASTER_WHISPER_URL missing' },
      'transcribe: falling back to MockTranscriptionProvider',
    );
    return MockTranscriptionProvider.fromText(
      'Mock transcription — FASTER_WHISPER_URL not configured.',
      30_000,
    );
  }

  return transcriptionFactory({
    kind,
    ...(env.OPENAI_API_KEY !== undefined
      ? {
          whisperApi: {
            apiKey: env.OPENAI_API_KEY,
            ...(env.TRANSCRIBE_TIMEOUT_MS !== undefined
              ? { timeoutMs: env.TRANSCRIBE_TIMEOUT_MS }
              : {}),
          },
        }
      : {}),
    ...(env.FASTER_WHISPER_URL !== undefined
      ? {
          fasterWhisper: {
            endpoint: env.FASTER_WHISPER_URL,
            ...(env.TRANSCRIBE_TIMEOUT_MS !== undefined
              ? { timeoutMs: env.TRANSCRIBE_TIMEOUT_MS }
              : {}),
          },
        }
      : {}),
  });
};

export const createTranscribeHandler = (deps: TranscribeHandlerDeps) => {
  const { db, storage, logger, transcriptionFactory, env } = deps;

  return async (job: TranscribeJob): Promise<void> => {
    const parsed = transcribeJobPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      logger.error({ issues: parsed.error.issues }, 'transcribe: invalid payload');
      throw new Error('transcribe: invalid payload');
    }
    const data = parsed.data;
    const ctx: { tenantId: string; region: Region } = {
      tenantId: data.tenantId,
      region: data.region,
    };
    logger.info(
      { recordingId: data.recordingId, tenantId: data.tenantId, region: data.region },
      'transcribe: started',
    );

    try {
      await withJobContext(db, ctx, async (tx) => {
        // 1. Read the recording row.
        const recRows = await tx
          .select({
            id: recordings.id,
            status: recordings.status,
            tenantId: recordings.tenantId,
            meetingId: recordings.meetingId,
            storageKey: recordings.storageKey,
            contentType: recordings.contentType,
          })
          .from(recordings)
          .where(and(eq(recordings.id, data.recordingId), eq(recordings.tenantId, data.tenantId)))
          .limit(1);
        const recording = recRows[0];
        if (!recording) {
          throw new TranscriptionError(`recording not found: ${data.recordingId}`);
        }

        // Idempotency guard — re-fired job after a worker crash.
        if (recording.status === 'transcribing' || recording.status === 'completed') {
          logger.info(
            { recordingId: recording.id, status: recording.status },
            'transcribe: skipping — already in terminal/in-flight state',
          );
          return;
        }
        if (recording.status !== 'uploaded') {
          throw new TranscriptionError(
            `recording in unexpected status: ${recording.status} (expected 'uploaded')`,
          );
        }
        if (recording.meetingId === null) {
          // Recordings without a meeting are not transcribed in 2.2; the
          // capture flow always attaches a meetingId by `complete` time.
          throw new TranscriptionError('recording has no associated meetingId');
        }

        // 2. Read the tenant compliance posture + region.
        const tenantRows = await tx
          .select({
            region: tenants.region,
            compliancePosture: tenants.compliancePosture,
          })
          .from(tenants)
          .where(eq(tenants.id, data.tenantId))
          .limit(1);
        const tenant = tenantRows[0];
        if (!tenant) {
          throw new TranscriptionError(`tenant not found: ${data.tenantId}`);
        }
        if (tenant.region !== data.region) {
          throw new TranscriptionError(
            `region mismatch: tenant=${tenant.region} job=${data.region}`,
          );
        }

        // 3. uploaded → transcribing
        await tx
          .update(recordings)
          .set({ status: 'transcribing', updatedAt: new Date() })
          .where(and(eq(recordings.id, recording.id), eq(recordings.tenantId, recording.tenantId)));

        // 4. Presign GET so the provider can fetch the audio.
        const presigned = await storage.presignGet(recording.storageKey, {
          expiresInSeconds: PRESIGN_GET_EXPIRY_SECONDS,
        });

        // 5. Pick + build the provider.
        const provider = buildProvider(
          { transcriptionFactory, env, logger },
          { region: tenant.region, compliancePosture: tenant.compliancePosture ?? {} },
          data.tenantId,
        );

        // 6. Run the transcription.
        const result = await provider.transcribe({
          audioUrl: presigned.url,
          contentType: recording.contentType,
          tenantId: data.tenantId,
        });

        logger.info(
          {
            recordingId: recording.id,
            providerKind: provider.kind,
            segmentCount: result.segments.length,
            durationMs: result.durationMs,
          },
          'transcribe: provider returned',
        );

        // 7. Optional diarization post-pass (Story 2.4). Pyannote runs
        // when the engine doesn't return native speaker labels and a
        // diarization provider is wired; faster-whisper engines use
        // their own labels, so we skip the pass entirely there.
        let segmentsForPersist: readonly TranscriptionSegment[] = result.segments;
        // The mock engine returns null speakers like whisper-api does,
        // so it inherits the post-pass strategy.
        const engineKindForStrategy = provider.kind === 'mock' ? 'whisper-api' : provider.kind;
        if (
          deps.diarizationProvider &&
          selectDiarizationStrategy(engineKindForStrategy) === 'pyannote-post-pass'
        ) {
          try {
            const diarized = await deps.diarizationProvider.diarize({
              audioUrl: presigned.url,
              contentType: recording.contentType,
              tenantId: data.tenantId,
            });
            segmentsForPersist = mergeDiarization(result.segments, diarized.regions);
            logger.info(
              {
                recordingId: recording.id,
                speakerCount: diarized.speakerCount,
                regionCount: diarized.regions.length,
              },
              'transcribe: diarization merged',
            );
          } catch (diarizeErr) {
            // Diarization is best-effort — a failure leaves segments
            // with `speaker: null`. Citations still resolve via turnId.
            logger.warn(
              { err: diarizeErr, recordingId: recording.id },
              'transcribe: diarization failed; persisting null speakers',
            );
          }
        }

        // 8. Map segments → speaker_turns and insert in the same tx.
        const meetingId = recording.meetingId;
        const turnRows = segmentsForPersist.map((seg, i) => {
          const turnId = computeTurnId({
            meetingId,
            sequence: i,
            speaker: seg.speaker,
            spanStartMs: seg.startMs,
            text: seg.text,
          });
          return {
            tenantId: data.tenantId,
            meetingId,
            turnId,
            speaker: seg.speaker,
            spanStartMs: seg.startMs,
            spanEndMs: seg.endMs,
            text: seg.text,
            confidence: seg.confidence.toFixed(3),
            sequence: i,
          };
        });

        if (turnRows.length > 0) {
          await tx.insert(speakerTurns).values(turnRows);
        }

        // 9. transcribing → completed
        await tx
          .update(recordings)
          .set({
            status: 'completed',
            transcribedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(recordings.id, recording.id), eq(recordings.tenantId, recording.tenantId)));

        // TODO(Story 1.4 follow-up): wire worker-side audit-logger so we
        // can emit `recording.transcribed` (or similar) here. The API
        // counterpart lives at apps/api/src/plugins/audit-logger; the
        // worker needs an equivalent injectable that writes the same
        // immutable audit_logs row with provider_kind + duration_ms in
        // the metadata bag.
      });

      // Story 3.2 + 3.3 — fan out into the analysis pipeline. We do
      // this OUTSIDE the withJobContext block so the queue writes
      // happen against pg-boss's own connection, not the tenant-scoped
      // tx. Failures here log + continue (transcription succeeded; the
      // analysis fan-out can be re-fired manually via an admin tool).
      if (deps.analysisEnqueuer) {
        const meetingId = await readMeetingIdForRecording(deps, ctx, data.recordingId);
        if (meetingId !== null) {
          try {
            await deps.analysisEnqueuer.enqueueSummarize({
              meetingId,
              tenantId: data.tenantId,
              region: data.region,
            });
            await deps.analysisEnqueuer.enqueueActionItems({
              meetingId,
              tenantId: data.tenantId,
              region: data.region,
            });
          } catch (enqueueErr) {
            logger.error(
              { err: enqueueErr, recordingId: data.recordingId, meetingId },
              'transcribe: analysis fan-out enqueue failed (transcription remained completed)',
            );
          }
        }
      }

      logger.info({ recordingId: data.recordingId }, 'transcribe: completed');
    } catch (err) {
      const isTranscriptionFailure = err instanceof TranscriptionError;
      const reason = err instanceof Error ? err.message : 'transcribe: unknown error';
      // Best-effort failure marker — runs in a fresh withJobContext so
      // the failed status is visible even if the original tx rolled back.
      try {
        await withJobContext(db, ctx, async (tx) => {
          await tx
            .update(recordings)
            .set({
              status: 'failed',
              failureReason: reason.slice(0, 500),
              updatedAt: new Date(),
            })
            .where(
              and(eq(recordings.id, data.recordingId), eq(recordings.tenantId, data.tenantId)),
            );
        });
      } catch (markErr) {
        logger.error(
          { err: markErr, recordingId: data.recordingId },
          'transcribe: failed-state write also failed',
        );
      }

      logger.error(
        {
          err,
          recordingId: data.recordingId,
          tenantId: data.tenantId,
          isTranscriptionFailure,
        },
        'transcribe: failed',
      );
      throw err;
    }
  };
};

export const TRANSCRIBE_QUEUE = 'transcribe';

/**
 * Re-read the recording row for its meetingId. The handler already
 * checked this inside the main tx; we re-read here to keep the
 * fan-out path independent of the tx that just committed.
 */
const readMeetingIdForRecording = async (
  deps: Pick<TranscribeHandlerDeps, 'db'>,
  ctx: { tenantId: string; region: Region },
  recordingId: string,
): Promise<string | null> => {
  return await withJobContext(deps.db, ctx, async (tx) => {
    const rows = await tx
      .select({ meetingId: recordings.meetingId })
      .from(recordings)
      .where(and(eq(recordings.id, recordingId), eq(recordings.tenantId, ctx.tenantId)))
      .limit(1);
    return rows[0]?.meetingId ?? null;
  });
};
