/**
 * `apps/bot` — meeting-bot service.
 *
 * Producer-side worker that consumes `bot.join` jobs from pg-boss and
 * drives the `bot_sessions` FSM via `@aisecretary/bot`. Receive-side
 * substrate (heartbeat watchdog, notification dispatch, mobile/web
 * status surface) lives in `apps/workers` + `packages/notifications` +
 * `apps/mobile`.
 *
 * Production boot lives in `./start.ts` (`startBotService(env)`):
 *   1. createDb / createBoss / Redis (REDIS_URL optional in non-prod)
 *   2. Drizzle-backed BotSessionsReadWriter / RecordingsSinkWriter /
 *      BotAuditLogger
 *   3. PgBoss-backed TranscribeEnqueuer
 *   4. Redis-backed HeartbeatPublisher (in-memory fallback when
 *      REDIS_URL is unset, with a production warning)
 *   5. Provider config from env (Zoom S2S OAuth, Teams Graph). When
 *      creds are missing, the cred-validating provider constructors in
 *      `packages/bot/src/providers/{zoom,teams}.ts` throw
 *      `BotProviderUnavailableError` at handler invocation time. The
 *      service still boots cleanly.
 *
 * `main` runs as the entry point when invoked directly (`node
 * dist/index.js`); test imports go through `startBotService` directly.
 */

import { loadEnv } from './env.js';
import { startBotService } from './start.js';

export { APP_NAME, type BotServiceHandle, startBotService } from './start.js';
export { type Env, loadEnv, resolveMode } from './env.js';

export {
  BOT_JOIN_QUEUE,
  type BotAuditLogger,
  type BotAuditLogInput,
  type BotJoinHandlerDeps,
  type BotJoinJob,
  type BotJoinJobPayload,
  type BotSessionRow as HandlerBotSessionRow,
  type BotSessionsReadWriter,
  type UpdateBotSessionInput as HandlerUpdateBotSessionInput,
  botJoinJobPayloadSchema,
  createBotJoinHandler,
} from './handlers/bot-join.js';

export {
  type AudioSink,
  type AudioSinkHandle,
  type AudioSinkOpenInput,
  InMemoryAudioSink,
} from './lib/audio-sink.js';

export {
  type HeartbeatPublisher,
  type HeartbeatPublisherHandle,
  type HeartbeatPublisherStartInput,
  InMemoryHeartbeatPublisher,
} from './lib/heartbeat-publisher.js';

export {
  type BotTranscribeEnqueuer,
  type RecordingsChunkUploadAudioSinkOptions,
  type RecordingsSinkWriter,
  RecordingsChunkUploadAudioSink,
} from './lib/recordings-chunk-upload-audio-sink.js';

export { WAV_STREAMING_SIZE_SENTINEL, wavHeader } from './lib/wav-encoder.js';

export { DrizzleBotSessionsReadWriter } from './lib/drizzle-bot-sessions-readwriter.js';
export { DrizzleRecordingsSinkWriter } from './lib/drizzle-recordings-sink-writer.js';
export { DrizzleBotAuditLogger } from './lib/drizzle-bot-audit-logger.js';
export {
  PgBossTranscribeEnqueuer,
  TRANSCRIBE_QUEUE,
} from './lib/pgboss-transcribe-enqueuer.js';
export { RedisHeartbeatPublisher } from './lib/redis-heartbeat-publisher.js';
export { createBoss, gracefulStop } from './lib/boss.js';

const main = async (): Promise<void> => {
  const env = loadEnv();
  const handle = await startBotService(env);

  const shutdown = async (): Promise<void> => {
    try {
      await handle.close();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown();
  });
  process.on('SIGINT', () => {
    void shutdown();
  });
};

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  void main();
}
