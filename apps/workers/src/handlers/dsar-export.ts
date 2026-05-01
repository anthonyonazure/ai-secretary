/**
 * `dsar.export` queue handler — Story 14.1.
 *
 * Lifecycle (FSM mirrors `dsar_requests.status`):
 *
 *   queued → processing → ready    (success path)
 *                       ↘ failed   (any thrown exception)
 *
 * Steps (matches spec):
 *   1. Validate payload (zod).
 *   2. Inside withJobContext({tenantId, region}):
 *      a. dsarRepository.markProcessing(requestId)
 *      b. exportReader.readUserData(tenantId, userId)  → DsarPayload
 *      c. Build a zip with one JSON file per registered table + the
 *         audio blobs for every owned recording.
 *      d. Upload zip via packages/storage multipart.
 *      e. Mint a 7-day presigned-GET URL via storage.presignGet.
 *      f. dsarRepository.markReady(requestId, {storageKey, downloadUrl,
 *         downloadExpiresAt, sizeBytes})
 *      g. Enqueue notification.send (kind='dsar-ready') with the
 *         `dsar` template context.
 *      h. Audit `dsar.export-completed` (currently logger-only — see
 *         note below).
 *   3. On any error: markFailed + audit `dsar.export-failed` + dispatch
 *      `dsar-failed` email so the requester knows to re-file.
 *
 * Worker-side audit logger: not yet wired; the API counterpart lives at
 * `apps/api/src/plugins/audit-logger.ts` and the worker needs an
 * equivalent injectable. For Story 14.1 we structure-log the action +
 * metadata so observability tooling can extract it; Story 1.4 follow-up
 * will introduce the worker-side audit-logger and the handler will
 * write a real `audit_logs` row through it.
 *
 * Zip library choice: `archiver@^7`. Streaming zip with a small memory
 * footprint vs. `jszip` which buffers the whole archive into a single
 * `Uint8Array` before flush. The DSAR bundle includes raw audio blobs
 * which can be hundreds of MB per request — streaming wins on memory.
 */

import { PassThrough, type Readable } from 'node:stream';
import type { Db, Region } from '@aisecretary/db';
import {
  QUEUE_NAME as NOTIFICATION_QUEUE_NAME,
  type NotificationKind,
  type NotificationRequest,
} from '@aisecretary/notifications';
import type { MultipartPart, StorageProvider } from '@aisecretary/storage';
import archiver from 'archiver';
import type pino from 'pino';
import { z } from 'zod';
import { withJobContext } from '../lib/job-context.js';
import type { DsarExportReader, DsarPayload } from './dsar-export-reader.js';

export const DSAR_EXPORT_QUEUE = 'dsar.export' as const;
export { NOTIFICATION_QUEUE_NAME };

const DSAR_DOWNLOAD_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Stream chunks to S3 as parts of at least 5 MiB (S3 minimum part size). */
const MULTIPART_CHUNK_BYTES = 5 * 1024 * 1024;

export const dsarExportJobPayloadSchema = z.object({
  requestId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  region: z.enum(['us', 'eu']),
});
export type DsarExportJobPayload = z.infer<typeof dsarExportJobPayloadSchema>;

/** Minimal job envelope — same shape the transcribe handler uses. */
export interface DsarExportJob {
  data: DsarExportJobPayload;
}

/**
 * Worker-side DSAR repository contract. Mirrors the shape the API
 * `DsarRepository` exposes, narrowed to the lifecycle methods the
 * handler needs. Production wires a Drizzle-backed implementation;
 * tests inject an in-memory shim.
 */
export interface WorkerDsarRepository {
  markProcessing(id: string): Promise<void>;
  markReady(
    id: string,
    input: {
      storageKey: string;
      downloadUrl: string;
      downloadExpiresAt: Date;
      sizeBytes: number;
    },
  ): Promise<void>;
  markFailed(id: string, reason: string): Promise<void>;
}

/**
 * Notification-enqueue seam — wraps `boss.send('notification.send',
 * payload)`. Mirrors the watchdog's enqueuer to keep the handler
 * test-friendly.
 */
export interface DsarNotificationEnqueuer {
  enqueue(request: NotificationRequest): Promise<void>;
}

/**
 * Audio-blob fetcher — the handler presigns each recording's storage
 * key with `storage.presignGet` and HTTP-fetches the bytes. Pluggable
 * so tests don't have to spin up a real HTTP server.
 */
export interface DsarAudioFetcher {
  fetch(args: { url: string }): Promise<Buffer>;
}

const defaultAudioFetcher: DsarAudioFetcher = {
  async fetch({ url }) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`audio fetch failed: ${res.status} ${res.statusText}`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  },
};

export interface DsarExportHandlerDeps {
  db: Db;
  storage: StorageProvider;
  dsarRepository: WorkerDsarRepository;
  notificationEnqueuer: DsarNotificationEnqueuer;
  exportReader: DsarExportReader;
  logger: pino.Logger;
  /** Optional override for tests. */
  audioFetcher?: DsarAudioFetcher;
  /** Optional override for tests — controls the email recipient resolution. */
  resolveRecipientEmail?: (args: {
    tenantId: string;
    userId: string;
    payload: DsarPayload;
  }) => { email: string; name?: string } | null;
}

const defaultRecipientResolver = ({
  payload,
}: {
  tenantId: string;
  userId: string;
  payload: DsarPayload;
}): { email: string; name?: string } | null => {
  const userRow = payload.user[0];
  if (!userRow) return null;
  const email = typeof userRow.email === 'string' ? userRow.email : null;
  if (!email) return null;
  const name = typeof userRow.name === 'string' ? userRow.name : undefined;
  return name !== undefined ? { email, name } : { email };
};

/**
 * Build a zip stream containing one JSON file per table + audio blobs
 * for owned recordings. Returns the readable stream, the archive
 * controller (so the caller can `await archive.finalize()`), and a
 * deferred byte counter resolved on close.
 */
const buildZipStream = (args: {
  payload: DsarPayload;
  audioBlobs: Array<{ key: string; bytes: Buffer }>;
}): { stream: Readable; archive: archiver.Archiver; sizeBytesPromise: Promise<number> } => {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const passthrough = new PassThrough();
  let bytesWritten = 0;
  passthrough.on('data', (chunk: Buffer) => {
    bytesWritten += chunk.length;
  });
  const sizeBytesPromise = new Promise<number>((resolve, reject) => {
    passthrough.on('end', () => resolve(bytesWritten));
    passthrough.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(passthrough);

  // 1. JSON files (one per table key).
  for (const [name, rows] of Object.entries(args.payload)) {
    const json = JSON.stringify(rows, null, 2);
    archive.append(json, { name: `${name}.json` });
  }
  // 2. Audio blobs.
  for (const blob of args.audioBlobs) {
    // Strip leading slashes / tenant prefix for a tidy zip layout.
    const safeName = `audio/${blob.key.replace(/^\/+/, '')}`;
    archive.append(blob.bytes, { name: safeName });
  }
  return { stream: passthrough, archive, sizeBytesPromise };
};

/**
 * Stream the zip to S3 via multipart upload. We accumulate chunks
 * locally until each one hits the 5 MiB minimum, then PUT it as a
 * part. The final part can be smaller than 5 MiB.
 */
const uploadZipMultipart = async (args: {
  storage: StorageProvider;
  key: string;
  zipStream: Readable;
}): Promise<{ uploadId: string; parts: MultipartPart[] }> => {
  const init = await args.storage.createMultipartUpload(args.key, {
    contentType: 'application/zip',
  });
  const parts: MultipartPart[] = [];
  let buffer = Buffer.alloc(0);
  let partNumber = 1;

  const flushPart = async (final: boolean): Promise<void> => {
    if (buffer.length === 0 && !final) return;
    if (buffer.length === 0 && final && parts.length > 0) return;
    const presigned = await args.storage.presignPart({
      key: args.key,
      uploadId: init.uploadId,
      partNumber,
    });
    const res = await fetch(presigned.url, {
      method: 'PUT',
      body: buffer,
      headers: { 'content-length': String(buffer.length) },
    });
    if (!res.ok) {
      throw new Error(`upload part ${partNumber} failed: ${res.status} ${res.statusText}`);
    }
    const etag = res.headers.get('etag') ?? '';
    parts.push({ partNumber, etag });
    partNumber += 1;
    buffer = Buffer.alloc(0);
  };

  for await (const chunk of args.zipStream) {
    buffer = Buffer.concat([buffer, chunk as Buffer]);
    while (buffer.length >= MULTIPART_CHUNK_BYTES) {
      const head = buffer.subarray(0, MULTIPART_CHUNK_BYTES);
      const tail = buffer.subarray(MULTIPART_CHUNK_BYTES);
      const tmp = buffer;
      buffer = head;
      try {
        await flushPart(false);
      } finally {
        // Restore tail for the next iteration.
        buffer = tail;
        void tmp;
      }
    }
  }
  await flushPart(true);

  return { uploadId: init.uploadId, parts };
};

/**
 * Translate DsarPayload → audio blob fetches. Each recording row's
 * `storageKey` is presigned + downloaded; the bytes go into the zip.
 */
const fetchAudioBlobs = async (args: {
  storage: StorageProvider;
  audioFetcher: DsarAudioFetcher;
  payload: DsarPayload;
  logger: pino.Logger;
}): Promise<Array<{ key: string; bytes: Buffer }>> => {
  const blobs: Array<{ key: string; bytes: Buffer }> = [];
  for (const recording of args.payload.recordings) {
    const key = typeof recording.storageKey === 'string' ? recording.storageKey : null;
    if (!key) continue;
    try {
      const presigned = await args.storage.presignGet(key, {
        expiresInSeconds: 5 * 60,
      });
      const bytes = await args.audioFetcher.fetch({ url: presigned.url });
      blobs.push({ key, bytes });
    } catch (err) {
      args.logger.warn(
        { err, key, recordingId: recording.id },
        'dsar-export: audio blob fetch failed; continuing without it',
      );
    }
  }
  return blobs;
};

const buildNotificationRequest = (args: {
  tenantId: string;
  recipient: { email: string; name?: string };
  userId: string;
  requestId: string;
  downloadUrl: string;
  expiresAt: Date;
  kind: Extract<NotificationKind, 'dsar-ready'>;
}): NotificationRequest => ({
  tenantId: args.tenantId,
  kind: args.kind,
  recipient: {
    channel: 'email',
    email: args.recipient.email,
    userId: args.userId,
    ...(args.recipient.name ? { name: args.recipient.name } : {}),
  },
  payload: {
    channel: 'email',
    context: {
      userName: args.recipient.name ?? 'there',
      downloadUrl: args.downloadUrl,
      expiresAt: args.expiresAt.toISOString(),
      requestId: args.requestId,
    },
  },
  dedupKey: `dsar:${args.requestId}:${args.kind}`,
});

export const createDsarExportHandler = (deps: DsarExportHandlerDeps) => {
  const audioFetcher = deps.audioFetcher ?? defaultAudioFetcher;
  const resolveRecipient = deps.resolveRecipientEmail ?? defaultRecipientResolver;

  return async (job: DsarExportJob): Promise<void> => {
    const parsed = dsarExportJobPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      deps.logger.error({ issues: parsed.error.issues }, 'dsar-export: invalid payload');
      throw new Error('dsar-export: invalid payload');
    }
    const data = parsed.data;
    const ctx: { tenantId: string; region: Region } = {
      tenantId: data.tenantId,
      region: data.region,
    };

    deps.logger.info(
      { requestId: data.requestId, tenantId: data.tenantId, userId: data.userId },
      'dsar-export: started',
    );

    try {
      // Step 2 — main pipeline inside withJobContext.
      const result = await withJobContext(deps.db, ctx, async () => {
        // 2a. queued → processing
        await deps.dsarRepository.markProcessing(data.requestId);

        // 2b. Read all the user's data.
        const payload = await deps.exportReader.readUserData(data.tenantId, data.userId);

        // 2c-1. Fetch audio blobs for owned recordings.
        const audioBlobs = await fetchAudioBlobs({
          storage: deps.storage,
          audioFetcher,
          payload,
          logger: deps.logger,
        });

        // 2c-2. Build the zip stream.
        const { stream, archive, sizeBytesPromise } = buildZipStream({ payload, audioBlobs });

        // 2d. Upload to S3 — multipart so memory stays bounded.
        const storageKey = `dsar-exports/${data.tenantId}/${data.requestId}.zip`;
        const uploadPromise = uploadZipMultipart({
          storage: deps.storage,
          key: storageKey,
          zipStream: stream,
        });
        // Kick off the archive flush (writes happen as the multipart
        // pump consumes the stream).
        await archive.finalize();
        const { uploadId, parts } = await uploadPromise;
        await deps.storage.completeMultipartUpload({ key: storageKey, uploadId, parts });
        const sizeBytes = await sizeBytesPromise;

        // 2e. Presigned-GET URL (7 days).
        const presigned = await deps.storage.presignGet(storageKey, {
          expiresInSeconds: DSAR_DOWNLOAD_TTL_SECONDS,
        });

        // 2f. Mark ready.
        await deps.dsarRepository.markReady(data.requestId, {
          storageKey,
          downloadUrl: presigned.url,
          downloadExpiresAt: presigned.expiresAt,
          sizeBytes,
        });

        return { payload, presigned, sizeBytes };
      });

      // 2g. Recipient email — resolved from the payload's user row.
      const recipient = resolveRecipient({
        tenantId: data.tenantId,
        userId: data.userId,
        payload: result.payload,
      });
      if (recipient) {
        await deps.notificationEnqueuer.enqueue(
          buildNotificationRequest({
            tenantId: data.tenantId,
            recipient,
            userId: data.userId,
            requestId: data.requestId,
            downloadUrl: result.presigned.url,
            expiresAt: result.presigned.expiresAt,
            kind: 'dsar-ready',
          }),
        );
      } else {
        deps.logger.warn(
          { requestId: data.requestId, userId: data.userId },
          'dsar-export: no recipient email resolved — skipping email dispatch',
        );
      }

      // 2h. Worker-side audit (logger-only until the worker audit-logger lands).
      deps.logger.info(
        {
          audit: {
            action: 'dsar.export-completed',
            tenantId: data.tenantId,
            requestId: data.requestId,
            sizeBytes: result.sizeBytes,
          },
        },
        'dsar-export: completed',
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'dsar-export: unknown error';
      // Best-effort failure marker — runs in a fresh withJobContext so
      // the failed status is visible even if the original tx rolled back.
      try {
        await withJobContext(deps.db, ctx, async () => {
          await deps.dsarRepository.markFailed(data.requestId, reason);
        });
      } catch (markErr) {
        deps.logger.error(
          { err: markErr, requestId: data.requestId },
          'dsar-export: failed-state write also failed',
        );
      }

      // Best-effort failure email so the requester knows to re-file.
      try {
        // We don't have a payload to resolve the recipient from on the
        // failure path. Skip the email if we can't resolve.
        const fallbackPayload = await withJobContext(deps.db, ctx, async () => {
          return await deps.exportReader.readUserData(data.tenantId, data.userId);
        }).catch(() => null);
        if (fallbackPayload) {
          const recipient = resolveRecipient({
            tenantId: data.tenantId,
            userId: data.userId,
            payload: fallbackPayload,
          });
          if (recipient) {
            await deps.notificationEnqueuer.enqueue({
              tenantId: data.tenantId,
              kind: 'dsar-failed',
              recipient: {
                channel: 'email',
                email: recipient.email,
                userId: data.userId,
                ...(recipient.name ? { name: recipient.name } : {}),
              },
              payload: {
                channel: 'email',
                context: {
                  userName: recipient.name ?? 'there',
                  requestId: data.requestId,
                  failureReason: reason,
                },
              },
              dedupKey: `dsar:${data.requestId}:dsar-failed`,
            });
          }
        }
      } catch (notifyErr) {
        deps.logger.error(
          { err: notifyErr, requestId: data.requestId },
          'dsar-export: failure-email dispatch also failed',
        );
      }

      deps.logger.error(
        {
          err,
          requestId: data.requestId,
          tenantId: data.tenantId,
          audit: {
            action: 'dsar.export-failed',
            tenantId: data.tenantId,
            requestId: data.requestId,
            reason,
          },
        },
        'dsar-export: failed',
      );
      throw err;
    }
  };
};
