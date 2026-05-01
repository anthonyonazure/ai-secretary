/**
 * Workers entry point — boots pg-boss + registers handlers.
 *
 * Story 2.1 wired the `transcribe` queue with a stub handler.
 * Story 2.2 plugs in the real engine: the worker boots a
 * `StorageProvider` (presigned-GET URLs) + a `TranscriptionFactory`
 * and injects them into the handler.
 *
 * Subsequent stories register `summarize`, `analyze`, `index`,
 * `retention` (per architecture.md § Async work).
 *
 * Graceful shutdown: SIGTERM/SIGINT → stop pg-boss (in-flight jobs
 * complete or time out at 30s) → close the DB pool → exit.
 */

import { createDb } from '@aisecretary/db';
import { dsarRequests } from '@aisecretary/db/schema';
import {
  QUEUE_NAME as NOTIFICATION_SEND_QUEUE,
  type NotificationRequest,
} from '@aisecretary/notifications';
import { createStorageProvider } from '@aisecretary/storage';
import { createTranscriptionProvider } from '@aisecretary/transcription';
import { eq } from 'drizzle-orm';
import Redis from 'ioredis';
import type PgBoss from 'pg-boss';
import pino from 'pino';
import { type Env, loadEnv } from './env.js';
import { DrizzleDsarExportReader } from './handlers/dsar-export-reader.js';
import {
  DSAR_EXPORT_QUEUE,
  type WorkerDsarRepository,
  createDsarExportHandler,
} from './handlers/dsar-export.js';
import {
  RE_ENGAGEMENT_SCAN_CRON,
  RE_ENGAGEMENT_SCAN_QUEUE,
  createReEngagementScanHandler,
} from './handlers/re-engagement-scan.js';
import { DrizzleRecordingWatchdogReader } from './handlers/recording-watchdog-reader.js';
import {
  RECORDING_WATCHDOG_CRON,
  RECORDING_WATCHDOG_QUEUE,
  type WatchdogHeartbeatStore,
  createRecordingWatchdogHandler,
} from './handlers/recording-watchdog.js';
import { TRANSCRIBE_QUEUE, createTranscribeHandler } from './handlers/transcribe.js';
import { createBoss, gracefulStop } from './lib/boss.js';

export const APP_NAME = '@aisecretary/workers';

interface WorkerHandle {
  boss: PgBoss;
  close: () => Promise<void>;
}

export const startWorker = async (env: Env): Promise<WorkerHandle> => {
  const logger = pino({ level: env.LOG_LEVEL, name: APP_NAME });
  const { db, client } = createDb({
    databaseUrl: env.DATABASE_URL,
    region: env.REGION,
    poolSize: 4,
  });
  const boss = await createBoss({ databaseUrl: env.DATABASE_URL });

  // Storage — used by the transcribe handler to presign-GET audio for the
  // transcription engine. Defaults to the same S3 config the API uses;
  // alternative providers (Azure Blob, GCS, MinIO) plug in via the same
  // factory once their implementations land (post-2.1).
  const storage = createStorageProvider({
    kind: 's3',
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    ...(env.S3_ENDPOINT !== undefined ? { endpoint: env.S3_ENDPOINT } : {}),
    ...(env.S3_FORCE_PATH_STYLE !== undefined ? { forcePathStyle: env.S3_FORCE_PATH_STYLE } : {}),
  });

  // Register the transcribe handler. pg-boss invokes the handler in a
  // batch; we adapt to the single-job shape our handler expects.
  const transcribeHandler = createTranscribeHandler({
    db,
    storage,
    logger,
    transcriptionFactory: createTranscriptionProvider,
    env: {
      ...(env.OPENAI_API_KEY !== undefined ? { OPENAI_API_KEY: env.OPENAI_API_KEY } : {}),
      ...(env.FASTER_WHISPER_URL !== undefined
        ? { FASTER_WHISPER_URL: env.FASTER_WHISPER_URL }
        : {}),
      ...(env.TRANSCRIBE_TIMEOUT_MS !== undefined
        ? { TRANSCRIBE_TIMEOUT_MS: env.TRANSCRIBE_TIMEOUT_MS }
        : {}),
    },
  });
  await boss.work(TRANSCRIBE_QUEUE, { batchSize: env.TRANSCRIBE_CONCURRENCY }, async (jobs) => {
    for (const job of jobs) {
      await transcribeHandler({ data: job.data as never });
    }
  });
  logger.info({ queue: TRANSCRIBE_QUEUE }, 'worker: handler registered');

  // Story 1.7 — re-engagement scan. Hourly tick scans every tenant's
  // users table; users created 24h or 72h ago with zero recordings get
  // a `notification.send` job enqueued. Dedup happens at the gateway
  // (recipient + kind + dedup_key window).
  const reEngagementHandler = createReEngagementScanHandler({
    db,
    logger,
    enqueueNotification: async (request: NotificationRequest) => {
      await boss.send(NOTIFICATION_SEND_QUEUE, request);
    },
  });
  await boss.work(RE_ENGAGEMENT_SCAN_QUEUE, async () => {
    await reEngagementHandler();
  });
  await boss.schedule(RE_ENGAGEMENT_SCAN_QUEUE, RE_ENGAGEMENT_SCAN_CRON);

  // Story 14.1 — DSAR export. One-shot per request; teamSize: 1 keeps
  // memory bounded since each export streams a (potentially large) zip.
  const dsarWorkerRepository: WorkerDsarRepository = {
    async markProcessing(id) {
      await db.update(dsarRequests).set({ status: 'processing' }).where(eq(dsarRequests.id, id));
    },
    async markReady(id, input) {
      await db
        .update(dsarRequests)
        .set({
          status: 'ready',
          storageKey: input.storageKey,
          downloadUrl: input.downloadUrl,
          downloadExpiresAt: input.downloadExpiresAt,
          sizeBytes: input.sizeBytes,
          readyAt: new Date(),
        })
        .where(eq(dsarRequests.id, id));
    },
    async markFailed(id, reason) {
      await db
        .update(dsarRequests)
        .set({
          status: 'failed',
          failureReason: reason.slice(0, 500),
        })
        .where(eq(dsarRequests.id, id));
    },
  };
  const dsarExportHandler = createDsarExportHandler({
    db,
    storage,
    dsarRepository: dsarWorkerRepository,
    notificationEnqueuer: {
      async enqueue(request: NotificationRequest) {
        await boss.send(NOTIFICATION_SEND_QUEUE, request);
      },
    },
    exportReader: new DrizzleDsarExportReader(db),
    logger,
  });
  // batchSize: 1 keeps memory bounded — each export streams a
  // (potentially large) zip and we don't want concurrent streams
  // competing for the same worker process's heap.
  await boss.work(DSAR_EXPORT_QUEUE, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      await dsarExportHandler({ data: job.data as never });
    }
  });
  logger.info({ queue: DSAR_EXPORT_QUEUE }, 'worker: handler registered');
  logger.info(
    { queue: RE_ENGAGEMENT_SCAN_QUEUE, cron: RE_ENGAGEMENT_SCAN_CRON },
    'worker: re-engagement-scan schedule registered',
  );

  // Story 4.4 — recording-watchdog. Only register when Redis is
  // configured; without it the heartbeat protocol can't function and
  // scheduling the scan would just consume DB cycles checking an empty
  // store.
  let redisClient: Redis | null = null;
  if (env.REDIS_URL) {
    redisClient = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    const heartbeatStore: WatchdogHeartbeatStore = {
      async isHeartbeatLost(recordingId: string) {
        const value = await (redisClient as Redis).get(`heartbeat:${recordingId}`);
        return value === null;
      },
      async markWatchdogFired(recordingId: string, ttlSeconds: number) {
        await (redisClient as Redis).set(`watchdog-fired:${recordingId}`, '1', 'EX', ttlSeconds);
      },
      async hasWatchdogFired(recordingId: string) {
        const value = await (redisClient as Redis).get(`watchdog-fired:${recordingId}`);
        return value !== null;
      },
    };

    const reader = new DrizzleRecordingWatchdogReader(db);
    const watchdogHandler = createRecordingWatchdogHandler({
      reader,
      heartbeatStore,
      notificationEnqueuer: {
        async enqueueCaptureAtRisk(args) {
          // The watchdog hands us `(tenantId, recordingId, ownerUserId,
          // meetingId, dedupKey)`. The notification gateway expects a
          // canonical `notification.send` payload — we shape it here.
          // pushTokens is empty: the gateway / consumer resolves the
          // user's Expo tokens at dispatch time.
          await boss.send('notification.send', {
            tenantId: args.tenantId,
            kind: 'capture-at-risk',
            recipient: { channel: 'push', userId: args.ownerUserId, pushTokens: [] },
            payload: {
              channel: 'push',
              title: 'Recording may have stopped',
              body: 'Open AI Secretary to verify',
              data: {
                recordingId: args.recordingId,
                deepLink: args.meetingId
                  ? `/meetings/${args.meetingId}`
                  : `/recordings/${args.recordingId}`,
              },
            },
            dedupKey: args.dedupKey,
          });
        },
      },
      logger,
    });
    await boss.work(RECORDING_WATCHDOG_QUEUE, async () => {
      await watchdogHandler();
    });
    await boss.schedule(RECORDING_WATCHDOG_QUEUE, RECORDING_WATCHDOG_CRON);
    logger.info(
      { queue: RECORDING_WATCHDOG_QUEUE, cron: RECORDING_WATCHDOG_CRON },
      'worker: recording-watchdog schedule registered',
    );
  } else {
    logger.warn(
      'worker: REDIS_URL not set — recording-watchdog will NOT run; lost-ping detection disabled',
    );
  }

  return {
    boss,
    close: async () => {
      logger.info('worker: shutdown-initiated');
      try {
        await gracefulStop(boss);
      } finally {
        if (redisClient) {
          await redisClient.quit().catch(() => {});
        }
        await client.end({ timeout: 5 });
      }
      logger.info('worker: shutdown-complete');
    },
  };
};

const main = async (): Promise<void> => {
  const env = loadEnv();
  const handle = await startWorker(env);

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    void signal;
    try {
      await handle.close();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
};

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  void main();
}
