/**
 * Recordings routes — Story 2.1.
 *
 * Mount path: `/api/v1/recordings` (set by `buildServer()` via `prefix`).
 *
 * Lifecycle:
 *   1. POST /initiate                       → row + S3 multipart upload created
 *   2. POST /:recordingId/parts/:partNumber → presigned PUT URL per chunk
 *   3. POST /:recordingId/complete          → S3 finalises; status=uploaded;
 *                                             transcribe job enqueued
 *   4. POST /:recordingId/abort             → S3 aborts; status=failed
 *   5. GET  /:recordingId                   → status read
 *
 * Consent gate strategy (option-a from Story 2.1 spec):
 *   The `parts/:partNumber` and `complete` routes use the consent-check
 *   plugin's new `meetingIdResolver` config — the resolver does the
 *   `recordings.meetingId` lookup server-side. When the recording has
 *   no associated meetingId yet (common during initiate window), the
 *   resolver returns null and the gate is skipped. When it returns a
 *   meetingId, the existing `consentCheck(tenantId, meetingId)` runs.
 *
 *   Why a resolver and not an inline lookup: keeps the consent gate
 *   uniform across routes (one preHandler, one fail-closed default,
 *   one error shape). Inline checks would fragment the contract and
 *   make it easy to drift between routes.
 */

import { randomUUID } from 'node:crypto';
import {
  type AbortUploadResponse,
  type CompleteUploadResponse,
  type InitiateUploadResponse,
  type PartUrlResponse,
  type RecordingPlaybackResponse,
  type RecordingResponse,
  abortUploadResponseSchema,
  completeUploadRequestSchema,
  completeUploadResponseSchema,
  initiateUploadRequestSchema,
  initiateUploadResponseSchema,
  partUrlResponseSchema,
  recordingPlaybackResponseSchema,
  recordingResponseSchema,
} from '@aisecretary/shared';
import type { StorageProvider } from '@aisecretary/storage';
import { createPresignedUpload } from '@aisecretary/storage';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../lib/http-error.js';
import type { TranscribeEnqueuer, TranscribeJobPayload } from '../lib/transcribe-enqueue.js';
import type { HeartbeatStore } from '../plugins/redis.js';
import type { RecordingsRepository } from './recordings-repository.js';

/**
 * Notification enqueuer — Story 4.5 escalation hook.
 *
 * The `abort` route enqueues a `notification.send` job when the abort
 * reason is `'upload-retry-exhausted'`. The shape is intentionally
 * agnostic to pg-boss so tests inject an in-memory capture and
 * production wires a real PgBoss-backed enqueuer.
 */
export interface NotificationEnqueuer {
  enqueue(payload: NotificationJobPayload): Promise<string | null>;
}

export interface NotificationJobPayload {
  tenantId: string;
  kind: 'capture-at-risk' | 'upload-retry-exhausted';
  recipient:
    | { channel: 'push'; userId: string; pushTokens: string[] }
    | { channel: 'email'; userId?: string; email: string; name?: string };
  payload:
    | {
        channel: 'push';
        title: string;
        body: string;
        data?: Record<string, string | number | boolean>;
      }
    | { channel: 'email'; locale?: string; context: Record<string, unknown> };
  dedupKey?: string;
}

/** Default in-memory enqueuer — used by tests and dev when no queue is wired. */
export class InMemoryNotificationEnqueuer implements NotificationEnqueuer {
  public readonly jobs: Array<{ id: string; payload: NotificationJobPayload }> = [];
  private counter = 0;

  async enqueue(payload: NotificationJobPayload): Promise<string | null> {
    this.counter += 1;
    const id = `notif-${this.counter}`;
    this.jobs.push({ id, payload });
    return id;
  }
}

export interface RecordingsRoutesOptions {
  repository: RecordingsRepository;
  storage: StorageProvider;
  transcribeEnqueuer: TranscribeEnqueuer;
  /**
   * Optional. When provided, the `abort` route enqueues an escalation
   * push + email when the abort reason is `'upload-retry-exhausted'`.
   * Tests typically inject `InMemoryNotificationEnqueuer` to assert
   * what was enqueued.
   */
  notificationEnqueuer?: NotificationEnqueuer;
  /**
   * Heartbeat store — Story 4.4. The `heartbeat` route writes a
   * SETEX-style key with TTL 90s. When unset, we use the in-memory
   * fallback already wired through the `redis` plugin (so production
   * always has a usable store; tests inject explicitly).
   */
  heartbeatStore?: HeartbeatStore;
}

/** TTL for the heartbeat key — arch-addendums § 5: client emits every 30s, server expires at 90s. */
export const HEARTBEAT_TTL_SECONDS = 90;

const requireUser = (request: FastifyRequest): { userId: string; tenantId: string } => {
  if (!request.user) {
    throw new UnauthorizedError('Authentication required.');
  }
  if (!request.tenantId) {
    throw new ForbiddenError('Tenant context missing.');
  }
  return { userId: request.user.userId, tenantId: request.tenantId };
};

const recordingToResponse = (row: {
  id: string;
  meetingId: string | null;
  status: string;
  contentType: string;
  sizeBytes: number | null;
  storageKey: string;
  startedAt: Date;
  uploadedAt: Date | null;
  transcribedAt: Date | null;
  failureReason: string | null;
}): RecordingResponse => ({
  recordingId: row.id,
  meetingId: row.meetingId,
  status: row.status as RecordingResponse['status'],
  contentType: row.contentType,
  sizeBytes: row.sizeBytes,
  storageKey: row.storageKey,
  startedAt: row.startedAt.toISOString(),
  uploadedAt: row.uploadedAt ? row.uploadedAt.toISOString() : null,
  transcribedAt: row.transcribedAt ? row.transcribedAt.toISOString() : null,
  failureReason: row.failureReason,
});

/**
 * Resolver name used by the consent-check plugin. Production server boot
 * registers a resolver under this name that looks up the recording's
 * meetingId via the repository. Exported so `buildServer()` can wire it.
 */
export const RECORDING_MEETING_ID_RESOLVER = 'recordingMeetingId';

export const recordingsRoutes = (options: RecordingsRoutesOptions): FastifyPluginAsync => {
  return async (fastify) => {
    fastify.post(
      '/initiate',
      {
        config: {
          auditTags: ['recording.started'],
        },
      },
      async (request, reply) => {
        const { userId, tenantId } = requireUser(request);

        const parsed = initiateUploadRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid initiate payload', {
            extensions: {
              errors: parsed.error.issues.map((i) => ({
                path: i.path.join('.'),
                message: i.message,
                code: i.code,
              })),
            },
          });
        }

        const recordingId = randomUUID();
        // Tenant + recording id make for a stable, region-namespaced key.
        const storageKey = `tenants/${tenantId}/recordings/${recordingId}.bin`;

        const init = await createPresignedUpload(options.storage, {
          key: storageKey,
          contentType: parsed.data.contentType,
          ...(parsed.data.sizeBytes !== undefined ? { size: parsed.data.sizeBytes } : {}),
        });

        const row = await options.repository.create({
          id: recordingId,
          tenantId,
          meetingId: parsed.data.meetingId ?? null,
          ownerUserId: userId,
          storageKey,
          contentType: parsed.data.contentType,
          sizeBytes: parsed.data.sizeBytes ?? null,
          s3UploadId: init.uploadId,
        });

        const body: InitiateUploadResponse = {
          recordingId: row.id,
          uploadId: init.uploadId,
          key: init.key,
        };
        return reply.status(201).send(initiateUploadResponseSchema.parse(body));
      },
    );

    fastify.post<{
      Params: { recordingId: string; partNumber: string };
    }>(
      '/:recordingId/parts/:partNumber',
      {
        config: {
          // Consent gate via the recording → meeting resolver. See plugin
          // header comment for the rationale.
          requireConsent: { meetingIdResolver: RECORDING_MEETING_ID_RESOLVER },
          // No auditTag here: per-part presign is a high-frequency hot
          // path and audit-coverage CI accepts skipAudit on
          // POST routes that don't change tenant-scoped state. The
          // recording row is unchanged; only an S3 presigned URL is
          // generated.
          skipAudit: true,
        },
      },
      async (request, reply) => {
        const { tenantId } = requireUser(request);
        const { recordingId, partNumber: partNumberRaw } = request.params;
        const partNumber = Number.parseInt(partNumberRaw, 10);
        if (!Number.isFinite(partNumber) || partNumber < 1 || partNumber > 10_000) {
          throw new ValidationError('partNumber must be an integer between 1 and 10000');
        }
        const row = await options.repository.findById(recordingId, tenantId);
        if (!row) {
          throw new NotFoundError(`Recording ${recordingId} not found.`);
        }
        if (row.status !== 'uploading') {
          throw new ValidationError(
            `Recording ${recordingId} is in status '${row.status}'; parts can only be presigned while 'uploading'.`,
          );
        }
        if (!row.s3UploadId) {
          throw new ValidationError(
            `Recording ${recordingId} has no upload id; recreate via /initiate.`,
          );
        }

        const url = await options.storage.presignPart({
          key: row.storageKey,
          uploadId: row.s3UploadId,
          partNumber,
        });
        const body: PartUrlResponse = {
          partNumber,
          url: url.url,
          expiresAt: url.expiresAt.toISOString(),
        };
        return reply.status(200).send(partUrlResponseSchema.parse(body));
      },
    );

    fastify.post<{
      Params: { recordingId: string };
    }>(
      '/:recordingId/complete',
      {
        config: {
          requireConsent: { meetingIdResolver: RECORDING_MEETING_ID_RESOLVER },
          auditTags: ['recording.stopped'],
        },
      },
      async (request, reply) => {
        const { tenantId } = requireUser(request);
        const parsed = completeUploadRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid complete payload');
        }

        const row = await options.repository.findById(request.params.recordingId, tenantId);
        if (!row) {
          throw new NotFoundError(`Recording ${request.params.recordingId} not found.`);
        }
        if (row.status !== 'uploading') {
          throw new ValidationError(
            `Recording ${row.id} is in status '${row.status}'; complete is only valid from 'uploading'.`,
          );
        }
        if (!row.s3UploadId) {
          throw new ValidationError(`Recording ${row.id} has no upload id.`);
        }

        await options.storage.completeMultipartUpload({
          key: row.storageKey,
          uploadId: row.s3UploadId,
          parts: parsed.data.parts,
        });

        const updated = await options.repository.markUploaded({
          recordingId: row.id,
          tenantId,
        });

        const payload: TranscribeJobPayload = {
          recordingId: row.id,
          tenantId,
          region: request.region,
        };
        const transcribeJobId = await options.transcribeEnqueuer.enqueue(payload);

        const body: CompleteUploadResponse = {
          recordingId: updated.id,
          status: updated.status,
          transcribeJobId,
        };
        return reply.status(200).send(completeUploadResponseSchema.parse(body));
      },
    );

    fastify.post<{
      Params: { recordingId: string };
      Body?: { reason?: string };
    }>(
      '/:recordingId/abort',
      {
        config: {
          auditTags: ['recording.aborted'],
        },
      },
      async (request, reply) => {
        const { userId, tenantId } = requireUser(request);
        const rawReason =
          request.body && typeof request.body.reason === 'string' ? request.body.reason : null;
        const reason = rawReason ?? 'aborted';

        const row = await options.repository.findById(request.params.recordingId, tenantId);
        if (!row) {
          throw new NotFoundError(`Recording ${request.params.recordingId} not found.`);
        }

        // S3 abort is best-effort: we still mark the row failed even if
        // the abort call fails (e.g. upload id already cleaned up). The
        // log carries the underlying error for postmortems.
        if (row.s3UploadId && row.status === 'uploading') {
          try {
            await options.storage.abortMultipartUpload({
              key: row.storageKey,
              uploadId: row.s3UploadId,
            });
          } catch (err) {
            request.log.warn({ err, recordingId: row.id }, 'recordings: abort upstream failed');
          }
        }

        const updated = await options.repository.markFailed({
          recordingId: row.id,
          tenantId,
          reason,
        });

        // Story 4.5 — when the client gives up after the 10-min retry
        // budget, escalate. Push lands the user back on a banner in
        // ~seconds; email is the catch-all for cases where push is
        // suppressed. The dedup key is per-recording so a frantic user
        // re-aborting doesn't fan out a second escalation pair.
        if (rawReason === 'upload-retry-exhausted' && options.notificationEnqueuer) {
          try {
            await options.notificationEnqueuer.enqueue({
              tenantId,
              kind: 'upload-retry-exhausted',
              recipient: { channel: 'push', userId, pushTokens: [] },
              payload: {
                channel: 'push',
                title: "We couldn't finish your upload",
                body: 'Tap to retry or contact support',
                data: { recordingId: row.id, action: 'retry' },
              },
              dedupKey: `upload-retry-exhausted:${row.id}`,
            });
            // Email is the same kind, different channel — gateway template
            // logic owns the wording. We hand a placeholder email
            // recipient when the user row doesn't carry one in this
            // request context; the gateway resolves the canonical address
            // from the user row at dispatch time.
            await options.notificationEnqueuer.enqueue({
              tenantId,
              kind: 'upload-retry-exhausted',
              recipient: {
                channel: 'email',
                userId,
                email: request.user?.userId
                  ? `${request.user.userId}@user.placeholder`
                  : 'unknown@placeholder',
              },
              payload: {
                channel: 'email',
                context: { recordingId: row.id },
              },
              dedupKey: `upload-retry-exhausted:${row.id}:email`,
            });
          } catch (err) {
            request.log.warn(
              { err, recordingId: row.id },
              'recordings: upload-retry-exhausted notification enqueue failed',
            );
          }
        }

        const body: AbortUploadResponse = {
          recordingId: updated.id,
          status: updated.status,
        };
        return reply.status(200).send(abortUploadResponseSchema.parse(body));
      },
    );

    /**
     * Story 4.4 — heartbeat ping.
     *
     * The capturing client (web + mobile) emits this every 30s while a
     * recording is in-flight. The server writes a Redis (or in-memory)
     * key `heartbeat:<recordingId>` with TTL 90s. The watchdog (workers)
     * scans every 15s; missing key = "client probably died" → enqueue
     * a `capture-at-risk` push.
     *
     * Why no audit row: this is high-frequency (~120/hour per active
     * recording). Audit volume would dominate the table for no
     * actionable trail. The watchdog-triggered notification IS audited
     * (via `recording.at-risk`); that's the operational signal that
     * matters.
     */
    fastify.post<{
      Params: { recordingId: string };
    }>(
      '/:recordingId/heartbeat',
      {
        config: {
          requireConsent: { meetingIdResolver: RECORDING_MEETING_ID_RESOLVER },
          // High-frequency hot path — see the route block comment above.
          skipAudit: true,
        },
      },
      async (request, reply) => {
        const { tenantId } = requireUser(request);
        const row = await options.repository.findById(request.params.recordingId, tenantId);
        if (!row) {
          throw new NotFoundError(`Recording ${request.params.recordingId} not found.`);
        }
        // Heartbeat is only meaningful while the recording is in-flight.
        // For a `completed` or `failed` row, we 404 — there's nothing to
        // monitor.
        const inFlight =
          row.status === 'uploading' || row.status === 'uploaded' || row.status === 'transcribing';
        if (!inFlight) {
          throw new NotFoundError(
            `Recording ${row.id} is not in an in-flight state (status='${row.status}').`,
          );
        }
        const store = options.heartbeatStore ?? fastify.heartbeatStore;
        await store.setHeartbeat(row.id, HEARTBEAT_TTL_SECONDS);
        return reply.status(204).send();
      },
    );

    fastify.get<{
      Params: { recordingId: string };
    }>(
      '/:recordingId',
      {
        config: { skipAudit: true },
      },
      async (request, reply) => {
        const { tenantId } = requireUser(request);
        const row = await options.repository.findById(request.params.recordingId, tenantId);
        if (!row) {
          throw new NotFoundError(`Recording ${request.params.recordingId} not found.`);
        }
        return reply.status(200).send(recordingResponseSchema.parse(recordingToResponse(row)));
      },
    );

    /**
     * Presigned-GET playback URL for a completed recording.
     *
     * Same consent gate as `parts/:n` and `complete` — the recording's
     * meetingId is resolved server-side via the `recordingMeetingId`
     * resolver. When the recording isn't bound to a meeting, the gate
     * is skipped (resolver returns null) — consistent with the other
     * recordings routes.
     *
     * Only `'completed'` recordings get a playback URL: presigning a
     * key for a recording in `'uploading' | 'uploaded' | 'transcribing'
     * | 'failed'` is either premature (the object isn't whole yet) or
     * meaningless. We return 404 instead of 409 because the resource
     * "playback URL for recording X" simply doesn't exist yet — it's
     * not a state-conflict from the client's perspective.
     */
    fastify.get<{
      Params: { recordingId: string };
    }>(
      '/:recordingId/play',
      {
        config: {
          requireConsent: { meetingIdResolver: RECORDING_MEETING_ID_RESOLVER },
          skipAudit: true,
        },
      },
      async (request, reply) => {
        const { tenantId } = requireUser(request);
        const row = await options.repository.findById(request.params.recordingId, tenantId);
        if (!row) {
          throw new NotFoundError(`Recording ${request.params.recordingId} not found.`);
        }
        if (row.status !== 'completed') {
          throw new NotFoundError(
            `Recording ${row.id} is not yet playable (status='${row.status}').`,
          );
        }
        const presigned = await options.storage.presignGet(row.storageKey, {
          expiresInSeconds: 15 * 60,
        });
        const body: RecordingPlaybackResponse = {
          recordingId: row.id,
          url: presigned.url,
          expiresAt: presigned.expiresAt.toISOString(),
          contentType: row.contentType,
        };
        return reply.status(200).send(recordingPlaybackResponseSchema.parse(body));
      },
    );
  };
};
