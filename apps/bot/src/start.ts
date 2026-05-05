/**
 * `apps/bot` production boot.
 *
 * Boots the bot service as a single Node process:
 *   1. Validate env (zod).
 *   2. Open Postgres pool via `@aisecretary/db.createDb`.
 *   3. Open pg-boss + Redis (Redis optional: when unset the heartbeat
 *      uses an in-memory publisher and the watchdog won't see the keys
 *      — production must set REDIS_URL).
 *   4. Build the production deps bundle for `createBotJoinHandler`:
 *      Drizzle-backed BotSessionsReadWriter, RecordingsSinkWriter,
 *      BotAuditLogger; PgBoss-backed TranscribeEnqueuer; Redis-backed
 *      HeartbeatPublisher; S3-backed StorageProvider; provider config
 *      built from env (Zoom S2S OAuth + Teams Graph). When creds are
 *      missing, the cred-validating provider constructors throw
 *      `BotProviderUnavailableError` at handler invocation time — the
 *      service still boots cleanly.
 *   5. Register the handler on the `bot.join` queue.
 *   6. Wire SIGTERM/SIGINT graceful shutdown.
 *
 * Capture path verified end-to-end with mocks (chunk 3.5 tests). This
 * boot is the orchestration that turns those seams into a running
 * service.
 */

import { createDb } from '@aisecretary/db';
import { createStorageProvider } from '@aisecretary/storage';
import Redis from 'ioredis';
import type PgBoss from 'pg-boss';
import type { Job } from 'pg-boss';
import pino from 'pino';

import { type Env, resolveMode } from './env.js';
import { BOT_JOIN_QUEUE, createBotJoinHandler } from './handlers/bot-join.js';
import { createBoss, gracefulStop } from './lib/boss.js';
import { DrizzleBotAuditLogger } from './lib/drizzle-bot-audit-logger.js';
import { DrizzleBotSessionsReadWriter } from './lib/drizzle-bot-sessions-readwriter.js';
import { DrizzleRecordingsSinkWriter } from './lib/drizzle-recordings-sink-writer.js';
import { InMemoryHeartbeatPublisher } from './lib/heartbeat-publisher.js';
import { PgBossTranscribeEnqueuer } from './lib/pgboss-transcribe-enqueuer.js';
import { RecordingsChunkUploadAudioSink } from './lib/recordings-chunk-upload-audio-sink.js';
import { RedisHeartbeatPublisher } from './lib/redis-heartbeat-publisher.js';

export const APP_NAME = '@aisecretary/bot-service';

export interface BotServiceHandle {
  boss: PgBoss;
  close: () => Promise<void>;
}

export const startBotService = async (env: Env): Promise<BotServiceHandle> => {
  const logger = pino({ level: env.LOG_LEVEL, name: APP_NAME });
  const mode = resolveMode(env);

  const { db, client } = createDb({
    databaseUrl: env.DATABASE_URL,
    region: env.REGION,
    poolSize: 4,
  });
  const boss = await createBoss({ databaseUrl: env.DATABASE_URL });

  // Storage — chunked-upload sink presigns + uploads parts via this provider.
  const storage = createStorageProvider({
    kind: 's3',
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    ...(env.S3_ENDPOINT !== undefined ? { endpoint: env.S3_ENDPOINT } : {}),
    ...(env.S3_FORCE_PATH_STYLE !== undefined ? { forcePathStyle: env.S3_FORCE_PATH_STYLE } : {}),
  });

  // Redis — required in production for the heartbeat to reach the
  // watchdog. When unset, fall back to the in-memory publisher so the
  // service still boots (e.g. dev / smoke tests).
  let redisClient: Redis | null = null;
  const heartbeatPublisher = env.REDIS_URL
    ? (() => {
        redisClient = new Redis(env.REDIS_URL, {
          lazyConnect: false,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
        });
        return new RedisHeartbeatPublisher({ redis: redisClient, logger });
      })()
    : (() => {
        if (mode === 'production') {
          logger.warn(
            'bot: REDIS_URL not set in production — heartbeat will NOT reach the watchdog',
          );
        }
        return new InMemoryHeartbeatPublisher();
      })();

  // Drizzle adapters — production impls of the structural seams the
  // bot-join handler + audio sink consume.
  const botSessionsReadWriter = new DrizzleBotSessionsReadWriter(db, env.REGION);
  const recordingsRepository = new DrizzleRecordingsSinkWriter(db, env.REGION);
  const transcribeEnqueuer = new PgBossTranscribeEnqueuer({ boss });
  const auditLogger = new DrizzleBotAuditLogger({ db, region: env.REGION });
  const audioSink = new RecordingsChunkUploadAudioSink({
    storage,
    recordingsRepository,
    transcribeEnqueuer,
  });

  // Provider config — only attached when all required fields are
  // present. The cred-validating constructors in
  // `packages/bot/src/providers/{zoom,teams}.ts` throw on partial
  // configs, so opt out cleanly when any field is missing.
  const zoomConfig =
    env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET
      ? {
          accountId: env.ZOOM_ACCOUNT_ID,
          clientId: env.ZOOM_CLIENT_ID,
          clientSecret: env.ZOOM_CLIENT_SECRET,
          region: env.REGION,
          defaultDisplayName: env.BOT_DISPLAY_NAME,
        }
      : undefined;
  const teamsConfig =
    env.TEAMS_TENANT_ID && env.TEAMS_CLIENT_ID && env.TEAMS_CLIENT_SECRET
      ? {
          azureTenantId: env.TEAMS_TENANT_ID,
          clientId: env.TEAMS_CLIENT_ID,
          clientSecret: env.TEAMS_CLIENT_SECRET,
          region: env.REGION,
          defaultDisplayName: env.BOT_DISPLAY_NAME,
        }
      : undefined;

  const handler = createBotJoinHandler({
    botSessionsRepository: botSessionsReadWriter,
    audioSink,
    heartbeatPublisher,
    auditLogger,
    logger,
    mode,
    defaults: {
      displayName: env.BOT_DISPLAY_NAME,
      disclosureText: env.BOT_DISCLOSURE_TEXT,
    },
    sessionDurationMs: env.BOT_SESSION_DURATION_MS,
    providerConfig: {
      ...(zoomConfig ? { zoom: zoomConfig } : {}),
      ...(teamsConfig ? { teams: teamsConfig } : {}),
    },
  });

  await boss.work(
    BOT_JOIN_QUEUE,
    { batchSize: env.BOT_JOIN_CONCURRENCY },
    async (jobs: Job<unknown>[]) => {
      for (const job of jobs) {
        await handler({ data: job.data as never });
      }
    },
  );
  logger.info(
    {
      queue: BOT_JOIN_QUEUE,
      mode,
      region: env.REGION,
      hasZoomCreds: !!zoomConfig,
      hasTeamsCreds: !!teamsConfig,
      hasRedis: !!redisClient,
    },
    'bot: handler registered',
  );

  return {
    boss,
    close: async () => {
      logger.info('bot: shutdown-initiated');
      try {
        await gracefulStop(boss);
      } finally {
        if (redisClient) {
          await redisClient.quit().catch(() => {});
        }
        await client.end({ timeout: 5 });
      }
      logger.info('bot: shutdown-complete');
    },
  };
};
