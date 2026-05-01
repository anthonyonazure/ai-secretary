/**
 * `bot.join` queue handler — Story 9.x (chunk 3).
 *
 * Drives a `bot_sessions` row from `provisioning` through `joined → ended`
 * (clean leave) or `provisioning|joined → failed` (join refused, lost
 * connection, abort).
 *
 * Lifecycle:
 *   1. Validate payload (zod).
 *   2. Load the session row via `BotSessionsRepository`.
 *   3. Idempotency guard: if status is already terminal (`ended`/`failed`)
 *      log + return; if `joined`, also no-op (a re-fired job after
 *      successful first attempt is benign).
 *   4. Build the provider via `selectBotProviderKind` + `createBotProvider`.
 *      Provider-isolation discipline guarantees the SDK imports stay
 *      inside `packages/bot`.
 *   5. Call `provider.join(...)`. On failure (refused/timeout/cred
 *      missing), apply `failed` event, persist, audit, return.
 *   6. On success: apply `joined` event, persist, audit. Open the audio
 *      sink. Subscribe to provider audio. Start heartbeat publishing
 *      to the watchdog Redis key.
 *   7. Wait until either: `sessionDurationMs` elapses OR `abortSignal`
 *      fires. The abort path is the user-facing "stop bot" CTA;
 *      `sessionDurationMs` is a hard upper bound (4h default).
 *   8. Tear down — unsubscribe audio, close sink, stop heartbeat, call
 *      `provider.leave()`. Apply `ended` event, persist, audit.
 *   9. On any uncaught error during steps 6–8, apply `failed` event,
 *      persist, audit, attempt best-effort cleanup, then rethrow so
 *      pg-boss records the failure.
 *
 * Audio capture seam: chunk 3 ships the `AudioSink` interface with an
 * `InMemoryAudioSink` for tests. Chunk 3.5 wires the real implementation
 * against the existing `recordings` chunk-upload pipeline.
 *
 * Heartbeat publishing: the bot service emits Redis SETEX every 30s
 * (TTL 90s). The cross-tenant `bot-watchdog` worker scan reads
 * `heartbeat:bot:<sessionId>` and enqueues `bot-join-failed` notifications
 * on loss. See apps/workers/src/handlers/bot-watchdog.ts.
 */

import {
  BOT_HEARTBEAT_INTERVAL_MS,
  BOT_HEARTBEAT_TTL_SECONDS,
  type BotAudioListener,
  type BotAudioSubscription,
  type BotAuditAction,
  BotError,
  type BotJoinHandle,
  type BotJoinRequest,
  type BotProvider,
  type BotProviderKind,
  type BotSession,
  type BotSessionStatus,
  type BotSource,
  type Region,
  applyEvent,
  createBotProvider,
  selectBotProviderKind,
} from '@aisecretary/bot';
import type pino from 'pino';
import { z } from 'zod';

import type { AudioSink, AudioSinkHandle } from '../lib/audio-sink.js';
import type { HeartbeatPublisher, HeartbeatPublisherHandle } from '../lib/heartbeat-publisher.js';

/**
 * Minimal repository surface this handler needs. The concrete impl
 * (`DrizzleBotSessionsRepository` / `InMemoryBotSessionsRepository`)
 * lives in `apps/api/src/routes/bot-sessions-repository.ts` and exposes
 * a wider CRUD surface; this handler only consumes the slice declared
 * here. Structural typing makes both impls compatible without an
 * import from apps/api.
 */
export interface BotSessionRow {
  id: string;
  tenantId: string;
  meetingId: string | null;
  ownerUserId: string;
  source: BotSource;
  status: BotSessionStatus;
  region: Region;
  externalMeetingId: string;
  joinedAt: Date | null;
  endedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateBotSessionInput {
  status?: BotSessionStatus;
  joinedAt?: Date | null;
  endedAt?: Date | null;
  failureReason?: string | null;
}

export interface BotSessionsReadWriter {
  findById(sessionId: string, tenantId: string): Promise<BotSessionRow | null>;
  update(
    sessionId: string,
    tenantId: string,
    patch: UpdateBotSessionInput,
  ): Promise<BotSessionRow | null>;
}

export const botJoinJobPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  tenantId: z.string().uuid(),
  region: z.enum(['us', 'eu']),
});
export type BotJoinJobPayload = z.infer<typeof botJoinJobPayloadSchema>;

export interface BotJoinJob {
  data: BotJoinJobPayload;
}

export interface BotAuditLogInput {
  action: BotAuditAction;
  tenantId: string;
  actorUserId: string;
  resourceType: 'bot_session';
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export interface BotAuditLogger {
  log(input: BotAuditLogInput): Promise<void>;
}

export interface BotJoinHandlerDeps {
  botSessionsRepository: BotSessionsReadWriter;
  audioSink: AudioSink;
  heartbeatPublisher: HeartbeatPublisher;
  auditLogger: BotAuditLogger;
  logger: pino.Logger;

  /** Default: `selectBotProviderKind`. Tests can force `'mock'` regardless of source. */
  selectKind?: typeof selectBotProviderKind;
  /** Default: `createBotProvider`. Tests can return a pre-built `MockBotProvider`. */
  providerFactory?: typeof createBotProvider;
  /** Per-source provider config. Empty in test mode (mock provider). */
  providerConfig?: {
    zoom?: Parameters<typeof createBotProvider>[0]['zoom'];
    teams?: Parameters<typeof createBotProvider>[0]['teams'];
    mock?: Parameters<typeof createBotProvider>[0]['mock'];
  };

  /** `production` in production; `dev`/`test` keeps the selector on mock. */
  mode: 'production' | 'dev' | 'test';

  /**
   * Default display name + disclosure copy for `BotJoinRequest`. Static
   * for the stub; chunk 4 will localize via the i18n substrate.
   */
  defaults: {
    displayName: string;
    disclosureText: string;
  };

  /** Hard upper bound on session duration. Defaults to 4 hours. */
  sessionDurationMs?: number;
  /** Test seam — controls the in-session wait. Defaults to a real timer. */
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
  clock?: () => Date;
}

const DEFAULT_SESSION_DURATION_MS = 4 * 60 * 60 * 1000;

const realWait = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    if (signal.aborted) {
      clearTimeout(t);
      resolve();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });

const buildJoinRequest = (
  row: BotSessionRow,
  defaults: BotJoinHandlerDeps['defaults'],
): BotJoinRequest => ({
  sessionId: row.id,
  tenantId: row.tenantId,
  externalMeetingId: row.externalMeetingId,
  displayName: defaults.displayName,
  disclosureText: defaults.disclosureText,
});

const auditAction = (event: 'joined' | 'ended' | 'failed'): BotAuditAction => {
  switch (event) {
    case 'joined':
      return 'bot.session.joined';
    case 'ended':
      return 'bot.session.ended';
    case 'failed':
      return 'bot.session.failed';
  }
};

const persistTransition = async (
  repo: BotSessionsReadWriter,
  session: BotSession,
): Promise<BotSessionRow | null> => {
  const patch: UpdateBotSessionInput = {
    status: session.status,
    joinedAt: session.joinedAt,
    endedAt: session.endedAt,
    failureReason: session.failureReason,
  };
  return await repo.update(session.sessionId, session.tenantId, patch);
};

const sessionFromRow = (row: BotSessionRow): BotSession => ({
  sessionId: row.id,
  tenantId: row.tenantId,
  ownerUserId: row.ownerUserId,
  meetingId: row.meetingId,
  source: row.source,
  region: row.region,
  externalMeetingId: row.externalMeetingId,
  status: row.status,
  joinedAt: row.joinedAt,
  endedAt: row.endedAt,
  failureReason: row.failureReason,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const createBotJoinHandler = (deps: BotJoinHandlerDeps) => {
  const {
    botSessionsRepository,
    audioSink,
    heartbeatPublisher,
    auditLogger,
    logger,
    defaults,
    mode,
  } = deps;
  const selectKind = deps.selectKind ?? selectBotProviderKind;
  const providerFactory = deps.providerFactory ?? createBotProvider;
  const sessionDurationMs = deps.sessionDurationMs ?? DEFAULT_SESSION_DURATION_MS;
  const wait = deps.wait ?? realWait;
  const clock = deps.clock ?? (() => new Date());

  return async (job: BotJoinJob, opts?: { abortSignal?: AbortSignal }): Promise<void> => {
    const parsed = botJoinJobPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      logger.error({ issues: parsed.error.issues }, 'bot-join: invalid payload');
      throw new Error('bot-join: invalid payload');
    }
    const data = parsed.data;

    const row = await botSessionsRepository.findById(data.sessionId, data.tenantId);
    if (!row) {
      logger.error(
        { sessionId: data.sessionId, tenantId: data.tenantId },
        'bot-join: session not found',
      );
      throw new Error('bot-join: session not found');
    }
    if (row.region !== data.region) {
      throw new Error(`bot-join: region mismatch row=${row.region} payload=${data.region}`);
    }
    if (row.status === 'ended' || row.status === 'failed') {
      logger.info(
        { sessionId: row.id, status: row.status },
        'bot-join: session already terminal — no-op',
      );
      return;
    }
    if (row.status === 'joined') {
      logger.info({ sessionId: row.id }, 'bot-join: session already joined — no-op (re-fire safe)');
      return;
    }

    let session = sessionFromRow(row);
    let provider: BotProvider;

    try {
      const kind: BotProviderKind = selectKind({ source: row.source, mode });
      provider = providerFactory({
        kind,
        ...(deps.providerConfig?.zoom !== undefined ? { zoom: deps.providerConfig.zoom } : {}),
        ...(deps.providerConfig?.teams !== undefined ? { teams: deps.providerConfig.teams } : {}),
        ...(deps.providerConfig?.mock !== undefined ? { mock: deps.providerConfig.mock } : {}),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'provider-construction-failed';
      session = applyEvent(session, { kind: 'failed', at: clock(), reason });
      await persistTransition(botSessionsRepository, session);
      await auditLogger.log({
        action: auditAction('failed'),
        tenantId: row.tenantId,
        actorUserId: row.ownerUserId,
        resourceType: 'bot_session',
        resourceId: row.id,
        metadata: { reason, stage: 'provider-construction' },
      });
      logger.error({ err, sessionId: row.id }, 'bot-join: provider construction failed');
      return;
    }

    let joinHandle: BotJoinHandle;
    try {
      const joinResult = await provider.join(buildJoinRequest(row, defaults));
      joinHandle = joinResult.handle;
      session = applyEvent(session, { kind: 'joined', at: joinResult.joinedAt });
      await persistTransition(botSessionsRepository, session);
      await auditLogger.log({
        action: auditAction('joined'),
        tenantId: row.tenantId,
        actorUserId: row.ownerUserId,
        resourceType: 'bot_session',
        resourceId: row.id,
        metadata: { participants: joinResult.participants.length, kind: provider.kind },
      });
      logger.info(
        { sessionId: row.id, kind: provider.kind, participants: joinResult.participants.length },
        'bot-join: joined',
      );
    } catch (err) {
      const reason =
        err instanceof BotError ? err.name : err instanceof Error ? err.message : 'unknown';
      session = applyEvent(session, { kind: 'failed', at: clock(), reason });
      await persistTransition(botSessionsRepository, session);
      await auditLogger.log({
        action: auditAction('failed'),
        tenantId: row.tenantId,
        actorUserId: row.ownerUserId,
        resourceType: 'bot_session',
        resourceId: row.id,
        metadata: { reason, stage: 'join' },
      });
      logger.error({ err, sessionId: row.id }, 'bot-join: provider.join() rejected');
      return;
    }

    let sinkHandle: AudioSinkHandle | null = null;
    let audioSubscription: BotAudioSubscription | null = null;
    let heartbeatHandle: HeartbeatPublisherHandle | null = null;
    let listenerError: unknown = null;

    const cleanup = async (): Promise<void> => {
      if (audioSubscription) {
        await audioSubscription.unsubscribe().catch((err) => {
          logger.warn({ err, sessionId: row.id }, 'bot-join: unsubscribe failed');
        });
      }
      if (heartbeatHandle) {
        await heartbeatHandle.stop().catch((err) => {
          logger.warn({ err, sessionId: row.id }, 'bot-join: heartbeat stop failed');
        });
      }
      if (sinkHandle) {
        await sinkHandle.close().catch((err) => {
          logger.warn({ err, sessionId: row.id }, 'bot-join: sink close failed');
        });
      }
      try {
        await provider.leave(joinHandle);
      } catch (err) {
        logger.warn({ err, sessionId: row.id }, 'bot-join: provider.leave() failed');
      }
    };

    try {
      sinkHandle = await audioSink.open({
        sessionId: row.id,
        tenantId: row.tenantId,
        meetingId: row.meetingId,
        ownerUserId: row.ownerUserId,
        region: row.region,
      });
      const listener: BotAudioListener = async (frame) => {
        try {
          await sinkHandle?.write(frame);
        } catch (err) {
          listenerError = err;
        }
      };
      audioSubscription = await provider.subscribeAudio(joinHandle, listener);
      heartbeatHandle = heartbeatPublisher.start({
        key: `heartbeat:bot:${row.id}`,
        intervalMs: BOT_HEARTBEAT_INTERVAL_MS,
        ttlSeconds: BOT_HEARTBEAT_TTL_SECONDS,
      });

      const innerController = new AbortController();
      const externalSignal = opts?.abortSignal;
      const onExternalAbort = () => {
        innerController.abort();
      };
      if (externalSignal) {
        if (externalSignal.aborted) innerController.abort();
        else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }

      try {
        await wait(sessionDurationMs, innerController.signal);
      } finally {
        if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
      }

      if (listenerError) {
        throw listenerError instanceof Error ? listenerError : new Error(String(listenerError));
      }

      await cleanup();

      session = applyEvent(session, { kind: 'ended', at: clock() });
      await persistTransition(botSessionsRepository, session);
      await auditLogger.log({
        action: auditAction('ended'),
        tenantId: row.tenantId,
        actorUserId: row.ownerUserId,
        resourceType: 'bot_session',
        resourceId: row.id,
        metadata: { kind: provider.kind },
      });
      logger.info({ sessionId: row.id }, 'bot-join: ended cleanly');
    } catch (err) {
      const reason =
        err instanceof BotError ? err.name : err instanceof Error ? err.message : 'unknown';
      await cleanup().catch(() => {
        /* swallow — failure cleanup is best-effort */
      });
      session = applyEvent(session, { kind: 'failed', at: clock(), reason });
      await persistTransition(botSessionsRepository, session);
      await auditLogger.log({
        action: auditAction('failed'),
        tenantId: row.tenantId,
        actorUserId: row.ownerUserId,
        resourceType: 'bot_session',
        resourceId: row.id,
        metadata: { reason, stage: 'in-session' },
      });
      logger.error({ err, sessionId: row.id }, 'bot-join: in-session failure');
    }
  };
};

/**
 * Re-exported handler-level constants the bot-service boot loop needs.
 * Keeps `apps/bot/src/index.ts` from depending on the package's lower
 * layers directly.
 */
export const BOT_JOIN_QUEUE = 'bot.join' as const;
