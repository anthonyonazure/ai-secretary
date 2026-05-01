/**
 * `apps/bot` — meeting-bot service.
 *
 * Producer-side worker that consumes `bot.join` jobs from pg-boss and
 * drives the `bot_sessions` FSM via `@aisecretary/bot`. Receive-side
 * substrate (heartbeat watchdog, notification dispatch, mobile/web
 * status surface) is already in `apps/workers` + `packages/notifications`
 * + `apps/mobile`.
 *
 * Public surface (re-exported for the production boot module):
 *   - `BOT_JOIN_QUEUE` — pg-boss queue name (`'bot.join'`)
 *   - `createBotJoinHandler` — the handler factory; returns a
 *     `(job) => Promise<void>` that production wraps in
 *     `await boss.work(BOT_JOIN_QUEUE, async (jobs) => { for (const j of
 *     jobs) await handler(j); })`
 *   - `BotJoinHandlerDeps` + handler-side seams (`AudioSink`,
 *     `HeartbeatPublisher`, `BotAuditLogger`, `BotSessionsReadWriter`)
 *
 * Production boot wiring (TODO — chunk 3.5 + multi-week build):
 *   1. createDb / createBoss / Redis client (per `apps/workers` pattern)
 *   2. Real `AudioSink` — chunked upload into the `recordings` pipeline
 *   3. Real `HeartbeatPublisher` — Redis SETEX `heartbeat:bot:<sid>`
 *   4. Real `BotAuditLogger` — postgres-backed sink, mirroring the
 *      worker-side audit logger added in a later sibling story
 *   5. Per-region provider configs (Zoom S2S OAuth, Teams Graph) — only
 *      after creds land
 *
 * The handler itself is fully exercised against MockBotProvider +
 * InMemory* seams in `bot-join.test.ts`; the production boot is the
 * remaining thin orchestration layer.
 */

export const APP_NAME = '@aisecretary/bot-service';

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
