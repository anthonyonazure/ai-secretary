import {
  InMemoryRefreshTokenStore,
  RedisRefreshTokenStore,
  type RefreshTokenStore,
  assertMfaEncryptionKey,
} from '@aisecretary/auth';
import type { StorageProvider } from '@aisecretary/storage';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { type Env, loadEnv } from './env.js';
import { PostgresAuditSink } from './lib/audit-sink-postgres.js';
import { type BotJoinEnqueuer, InMemoryBotJoinEnqueuer } from './lib/bot-join-enqueue.js';
import { createDbConsentChecker } from './lib/consent-checker-db.js';
import { type DbHandle, createDbHandle } from './lib/db.js';
import { createLogger } from './lib/logger.js';
import { InMemoryTranscribeEnqueuer, type TranscribeEnqueuer } from './lib/transcribe-enqueue.js';
import { type AuditSink, auditLoggerPlugin } from './plugins/audit-logger.js';
import {
  type ConsentCheckerFn,
  type MeetingIdResolverFn,
  consentCheckPlugin,
} from './plugins/consent-check.js';
import { dbPlugin } from './plugins/db.js';
import {
  type EntitlementRepository,
  InMemoryEntitlementRepository,
  entitlementCheckPlugin,
} from './plugins/entitlement-check.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { jwtPlugin } from './plugins/jwt.js';
import { type HeartbeatStore, redisPlugin } from './plugins/redis.js';
import { requestIdPlugin } from './plugins/request-id.js';
import { storagePlugin } from './plugins/storage.js';
import { tenantContextPlugin } from './plugins/tenant-context.js';
import { auditCoverageFixtureRoutes } from './routes/_audit-coverage-fixture.js';
import {
  type ActionItemsRepository,
  DrizzleActionItemsRepository,
} from './routes/action-items-repository.js';
import { actionItemsRoutes } from './routes/action-items.js';
import {
  type AuditExportRepository,
  DrizzleAuditExportRepository,
} from './routes/audit-export-repository.js';
import { auditExportRoutes } from './routes/audit-export.js';
import { type AuthRepository, DrizzleAuthRepository } from './routes/auth-repository.js';
import { authRoutes } from './routes/auth.js';
import {
  type BotSessionsRepository,
  DrizzleBotSessionsRepository,
} from './routes/bot-sessions-repository.js';
import { botSessionsRoutes } from './routes/bot-sessions.js';
import {
  type ChatRetriever,
  type ChatStreamer,
  buildMockStreamer,
  buildSearchBackedRetriever,
  chatRoutes,
} from './routes/chat.js';
import {
  type CrossOrgPolicyRepository,
  InMemoryCrossOrgPolicyRepository,
} from './routes/cross-org-policy-repository.js';
import { crossOrgPolicyRoutes } from './routes/cross-org-policy.js';
import {
  type DsarPortalRepository,
  InMemoryDsarPortalRepository,
} from './routes/dsar-portal-repository.js';
import { dsarPortalRoutes } from './routes/dsar-portal.js';
import { DrizzleDsarRepository, type DsarRepository } from './routes/dsar-repository.js';
import { type DsarExportEnqueuer, dsarRoutes } from './routes/dsar.js';
import {
  DrizzleErasurePreviewRepository,
  type ErasurePreviewRepository,
} from './routes/erasure-preview-repository.js';
import { erasurePreviewRoutes } from './routes/erasure-preview.js';
import {
  DrizzleFeedbackRepository,
  type FeedbackRepository,
} from './routes/feedback-repository.js';
import { feedbackRoutes } from './routes/feedback.js';
import { healthRoutes } from './routes/health.js';
import {
  DrizzleInboundSharesRepository,
  type InboundSharesRepository,
  type ReceivingTenantResolver,
} from './routes/inbound-shares-repository.js';
import { DrizzleInvitesRepository, type InvitesRepository } from './routes/invites-repository.js';
import { type InviteNotificationEnqueuer, invitesRoutes } from './routes/invites.js';
import {
  DrizzleMeetingsRepository,
  type MeetingsRepository,
} from './routes/meetings-repository.js';
import { meetingsRoutes } from './routes/meetings.js';
import {
  type OauthExchangeFn,
  noopOauthExchange,
  oauthProvidersFromEnv,
  oauthRoutes,
} from './routes/oauth.js';
import {
  DrizzleRecordingsRepository,
  type RecordingsRepository,
} from './routes/recordings-repository.js';
import {
  type NotificationEnqueuer,
  RECORDING_MEETING_ID_RESOLVER,
  recordingsRoutes,
} from './routes/recordings.js';
import { DrizzleSearchRepository, type SearchRepository } from './routes/search-repository.js';
import { searchRoutes } from './routes/search.js';
import { DrizzleSharesRepository, type SharesRepository } from './routes/shares-repository.js';
import { sharesRoutes } from './routes/shares.js';
import {
  DrizzleTenantAdminRepository,
  type TenantAdminRepository,
} from './routes/tenant-admin-repository.js';
import { tenantAdminRoutes } from './routes/tenant-admin.js';

export interface BuildServerOptions {
  /** Override env (tests). Production reads from `process.env`. */
  env?: Env;
  /** Override the audit sink (tests). Production wires the Postgres sink. */
  auditSink?: AuditSink;
  /**
   * Override the consent gate (tests). Production wires a real
   * `packages/consent` checker against the `consents` table. Default is
   * fail-closed (always `'missing'`).
   */
  consentChecker?: ConsentCheckerFn;
  /**
   * Optional pre-built DB handle. When supplied:
   *   - the `db` plugin registers `fastify.db`
   *   - the default audit sink becomes `PostgresAuditSink`
   *   - the default consent checker becomes the DB-backed one
   *
   * Tests typically omit this (and pass an in-memory audit sink + a
   * stub consent checker) to skip postgres entirely.
   */
  dbHandle?: DbHandle;
  /**
   * Override the refresh-token store (tests). Production wires
   * `RedisRefreshTokenStore` against `REDIS_URL` if available, else
   * `InMemoryRefreshTokenStore` as a dev fallback.
   */
  refreshStore?: RefreshTokenStore;
  /** Override the auth repository (tests). */
  authRepository?: AuthRepository;
  /** Override the invites repository (tests). Story 1.5d. */
  invitesRepository?: InvitesRepository;
  /** Override the invite-notification enqueuer (tests). Story 1.5d. */
  inviteNotificationEnqueuer?: InviteNotificationEnqueuer;
  /** Override the accept-invite URL base (tests). Story 1.5d. */
  inviteAppBaseUrl?: string;
  /** Override the recordings repository (tests). */
  recordingsRepository?: RecordingsRepository;
  /** Override the meetings repository (tests). */
  meetingsRepository?: MeetingsRepository;
  /** Override the feedback repository (tests). */
  feedbackRepository?: FeedbackRepository;
  /** Override the storage provider (tests). When unset, recordings routes
   * are not mounted — useful for tests that only care about /auth. */
  storageProvider?: StorageProvider;
  /** Override the transcribe enqueuer (tests). */
  transcribeEnqueuer?: TranscribeEnqueuer;
  /** Override the bot-sessions repository (tests). When unset and
   *  a dbHandle is present, defaults to Drizzle-backed. */
  botSessionsRepository?: BotSessionsRepository;
  /** Override the bot-join enqueuer (tests). Defaults to in-memory. */
  botJoinEnqueuer?: BotJoinEnqueuer;
  /**
   * Override the notification enqueuer (Story 4.5). Tests inject an
   * in-memory capture; production wires a real PgBoss-backed
   * `notification.send` enqueuer once the workers package owns it.
   */
  notificationEnqueuer?: NotificationEnqueuer;
  /**
   * Override the heartbeat store (Story 4.4). Production wires a Redis
   * client when `REDIS_URL` is set; tests + dev fall through to the
   * in-memory store.
   */
  heartbeatStore?: HeartbeatStore;
  /** Override the DSAR repository (Story 14.1). */
  dsarRepository?: DsarRepository;
  /**
   * Override the DSAR export enqueuer (Story 14.1). Tests inject the
   * in-memory capture; production wires a real PgBoss-backed enqueuer
   * once the workers package owns the `dsar.export` queue.
   */
  dsarExportEnqueuer?: DsarExportEnqueuer;
  /** Override the shares repository (Stories 8.1+8.2+8.3). */
  sharesRepository?: SharesRepository;
  /** Story 8.4 — receiving-tenant inbound-share dispatcher. */
  inboundSharesRepository?: InboundSharesRepository;
  /** Story 8.4 — recipient email domain → receiving tenant resolver. */
  receivingTenantResolver?: ReceivingTenantResolver;
  /** Story 8.4 — sender-side display label resolver. */
  resolveSenderTenantDomain?: (tenantId: string) => Promise<string | null>;
  /** Override the action-items repository (Story 8.5 — My Actions). */
  actionItemsRepository?: ActionItemsRepository;
  /** Override the audit-export repository (Story 14.5). */
  auditExportRepository?: AuditExportRepository;
  /** Override the erasure-preview repository (Story 14.4). */
  erasurePreviewRepository?: ErasurePreviewRepository;
  /** Override the search repository (Story 7.2). */
  searchRepository?: SearchRepository;
  /** Override the chat retriever (Story 6.1). Defaults to search-backed. */
  chatRetriever?: ChatRetriever;
  /** Override the chat streamer (Story 6.1). Defaults to deterministic mock. */
  chatStreamer?: ChatStreamer;
  /** Override the public DSAR portal repository (Story 14.3). */
  dsarPortalRepository?: DsarPortalRepository;
  /** Override the F2-admin tenant repository (Story 12.1). */
  tenantAdminRepository?: TenantAdminRepository;
  /** Override the cross-org accept-policy repository (Story 12.7). */
  crossOrgPolicyRepository?: CrossOrgPolicyRepository;
  /** Override the entitlement repository (Story 13.2). */
  entitlementRepository?: EntitlementRepository;
  /**
   * Story 13.3 — seat-ceiling check called by the invite-create route.
   * Wires through to `InvitesRoutesOptions.seatCeilingCheck`.
   */
  seatCeilingCheck?: (input: {
    tenantId: string;
  }) => Promise<{ allowed: true } | { allowed: false; ceiling: number; current: number }>;
  /** Override the DSAR-portal verification email dispatcher. */
  dsarPortalEmailDispatcher?: (input: {
    email: string;
    fullName: string;
    plaintextToken: string;
    expiresAt: Date;
  }) => Promise<void>;
  /**
   * Loader that pulls a meeting's display summary (title, duration,
   * recordedAt, tenant name) for the recipient-view payload + the
   * cross-org domain detection at create-time. Tests stub; production
   * wires through the meetings repository's projection helpers.
   */
  loadMeetingSummary?: (
    meetingId: string,
    tenantId: string,
  ) => Promise<{
    id: string;
    title: string;
    durationMs: number | null;
    recordedAt: Date | null;
    tenantName: string | null;
  } | null>;
  /** App base URL used to format public share URLs. */
  shareAppBaseUrl?: string;
  /**
   * Story 1.5b — OAuth code-exchange function. Tests inject a stub;
   * production wires the JWKS-verifying impl that hits Google/Microsoft
   * token endpoints + upserts the user.
   */
  oauthExchange?: OauthExchangeFn;
}

const resolveAuditSink = (
  fastify: FastifyInstance,
  options: BuildServerOptions,
): AuditSink | undefined => {
  if (options.auditSink) return options.auditSink;
  if (options.dbHandle) return new PostgresAuditSink(options.dbHandle.db);
  // Falls through to plugin's in-memory default.
  void fastify;
  return undefined;
};

const resolveConsentChecker = (options: BuildServerOptions): ConsentCheckerFn | undefined => {
  if (options.consentChecker) return options.consentChecker;
  if (options.dbHandle) {
    return createDbConsentChecker({
      db: options.dbHandle.db,
      region: options.dbHandle.region,
    });
  }
  return undefined;
};

const resolveRefreshStore = (
  options: BuildServerOptions,
  env: Env,
): { store: RefreshTokenStore; close: () => Promise<void> } => {
  if (options.refreshStore) {
    return { store: options.refreshStore, close: async () => {} };
  }
  if (env.REDIS_URL) {
    const redis = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    return {
      store: new RedisRefreshTokenStore(redis),
      close: async () => {
        await redis.quit();
      },
    };
  }
  // No Redis configured — fall back to in-memory. Acceptable for
  // single-instance dev; production deployments must set REDIS_URL.
  return { store: new InMemoryRefreshTokenStore(), close: async () => {} };
};

/**
 * Build a Fastify app instance.
 *
 * **Plugin registration order matters.** The pipeline:
 *
 *   1. `error-handler`     — set up first so subsequent throws are caught.
 *   2. `request-id`        — every later plugin/log line wants `requestId`.
 *   3. `cors` + `helmet`   — standard HTTP hygiene; no auth needed.
 *   4. `db` (optional)     — decorates `fastify.db` when a handle is passed.
 *   5. health routes       — registered BEFORE tenant-context so they're
 *                            exempt by virtue of `skipTenantContext`.
 *   6. `jwt`               — verifies `Authorization: Bearer ...` and
 *                            populates `request.user` (Story 1.5a).
 *   7. `tenant-context`    — fail-closed; reads `request.user.tenantId`
 *                            first, falls back to `x-tenant-id` in non-prod.
 *   8. `audit-logger`      — depends on tenant-context. Postgres sink
 *                            when a DB handle is available, in-memory
 *                            otherwise.
 *   9. `consent-check`     — depends on tenant-context; opt-in per route.
 *  10. application routes  — `/api/v1/auth/*` + the audit-coverage fixture.
 */
export const buildServer = async (options: BuildServerOptions = {}): Promise<FastifyInstance> => {
  const env = options.env ?? loadEnv();
  const fastify = Fastify({
    loggerInstance: createLogger({ level: env.LOG_LEVEL }) as unknown as FastifyBaseLogger,
    disableRequestLogging: false,
    trustProxy: true,
  });

  // 1. Error handler — must come first so plugin failures get the proper RFC 7807 shape.
  await fastify.register(errorHandlerPlugin);

  // 2. Request id — every log + every response header.
  await fastify.register(requestIdPlugin);

  // 3. Standard HTTP plumbing. `@fastify/cookie` registered alongside
  //    so auth routes can set httpOnly refresh cookies (Story 1.5e).
  await fastify.register(cors, { origin: true, credentials: true });
  await fastify.register(helmet, { global: true });
  await fastify.register(cookie, {});

  // 4. Optional DB plugin — only when a handle is passed.
  if (options.dbHandle) {
    await fastify.register(dbPlugin, { handle: options.dbHandle });
  }

  // 5. Health routes — registered before tenant-context so they bypass it via config.
  await fastify.register(healthRoutes);

  // 6. JWT — populates `request.user` from `Authorization` header. Does not
  //    401 by itself; route handlers + tenant-context decide.
  await fastify.register(jwtPlugin, { secret: env.JWT_SECRET });

  // 7. Tenant context — every request after this point has `request.tenantId`.
  await fastify.register(tenantContextPlugin, { env });

  // 8. Audit logger — depends on tenant-context.
  const auditSink = resolveAuditSink(fastify, options);
  const auditOptions = auditSink ? { sink: auditSink } : {};
  await fastify.register(auditLoggerPlugin, auditOptions);

  // 9. Consent gate — depends on tenant-context. Routes opt in via
  //    `config.requireConsent: true`. Default checker fails closed.
  //    Story 2.1 added a `recordingMeetingId` resolver — recording
  //    routes resolve their meetingId via a server-side lookup (kept
  //    in scope here so the resolver can capture the recordings
  //    repository without leaking it to other plugins).
  const consentChecker = resolveConsentChecker(options);
  const recordingsRepository: RecordingsRepository | undefined =
    options.recordingsRepository ??
    (options.dbHandle
      ? new DrizzleRecordingsRepository(options.dbHandle.db, options.dbHandle.region)
      : undefined);

  const resolvers: Record<string, MeetingIdResolverFn> = {};
  if (recordingsRepository) {
    resolvers[RECORDING_MEETING_ID_RESOLVER] = async (request) => {
      const params = request.params as { recordingId?: string };
      const recordingId = params.recordingId;
      if (!recordingId) return null;
      const row = await recordingsRepository.findById(recordingId, request.tenantId);
      return row?.meetingId ?? null;
    };
  }

  const consentOptions: {
    consentChecker?: ConsentCheckerFn;
    resolvers?: Record<string, MeetingIdResolverFn>;
  } = {};
  if (consentChecker) consentOptions.consentChecker = consentChecker;
  if (Object.keys(resolvers).length > 0) consentOptions.resolvers = resolvers;
  await fastify.register(consentCheckPlugin, consentOptions);

  // Entitlement-check (Story 13.2). Reads `tenant_entitlements` and
  // gates routes that opt in via `requireFeature` / `requireModule`.
  // In-memory repo by default; production wires the Drizzle variant
  // when the schema migration lands as a follow-up.
  const entitlementRepository: EntitlementRepository =
    options.entitlementRepository ?? new InMemoryEntitlementRepository();
  await fastify.register(entitlementCheckPlugin, { repository: entitlementRepository });

  // Storage plugin (optional — tests that only exercise /auth omit it).
  if (options.storageProvider) {
    await fastify.register(storagePlugin, { provider: options.storageProvider });
  }

  // Redis + heartbeat store (Story 4.4). Always registered so the
  // heartbeat route + watchdog have a usable store. Production wires
  // ioredis when REDIS_URL is set; tests + dev fall through to the
  // in-memory fallback. Tests that want explicit control inject
  // `heartbeatStore` via options.
  const redisPluginOptions: { redis?: Redis | null; heartbeatStore?: HeartbeatStore } = {};
  if (options.heartbeatStore) {
    redisPluginOptions.heartbeatStore = options.heartbeatStore;
  } else if (env.REDIS_URL) {
    // We separately reuse the refresh-token-store's Redis client when one
    // is configured; here we mint a dedicated client so heartbeat keys
    // don't compete for the same connection slot. ioredis pool size is
    // 1 by default — fine for both connections.
    redisPluginOptions.redis = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }
  await fastify.register(redisPlugin, redisPluginOptions);

  // 10. Application routes.
  const refreshState = resolveRefreshStore(options, env);
  fastify.addHook('onClose', async () => {
    await refreshState.close();
  });

  // Auth repository: drizzle-backed if DB available, else require
  // explicit injection (tests).
  const authRepository: AuthRepository | undefined =
    options.authRepository ??
    (options.dbHandle
      ? new DrizzleAuthRepository(options.dbHandle.db, options.dbHandle.region)
      : undefined);

  if (authRepository) {
    const mfaEncryptionKey = assertMfaEncryptionKey(env.MFA_SECRET_ENCRYPTION_KEY, env.NODE_ENV);
    if (env.NODE_ENV !== 'production' && !env.MFA_SECRET_ENCRYPTION_KEY) {
      fastify.log.warn(
        'MFA_SECRET_ENCRYPTION_KEY not set — using a deterministic dev key. Do NOT ship without setting it.',
      );
    }
    await fastify.register(
      authRoutes({
        repository: authRepository,
        refreshStore: refreshState.store,
        jwtSecret: env.JWT_SECRET,
        mfaChallengeSecret: env.JWT_MFA_CHALLENGE_SECRET,
        mfaEncryptionKey,
        region: env.REGION,
        isProduction: env.NODE_ENV === 'production',
      }),
      { prefix: '/api/v1/auth' },
    );
  }

  // Invites routes (Story 1.5d). Mounts the admin flow at
  // `/api/v1/tenants/:tenantId/invites` and the public accept flow at
  // `/api/v1/invites/:token`. Registered AFTER authRoutes so the JWT
  // plugin + tenant-context plugin chains are already wired; the
  // public routes opt out of tenant-context via `skipTenantContext`.
  const invitesRepository: InvitesRepository | undefined =
    options.invitesRepository ??
    (options.dbHandle
      ? new DrizzleInvitesRepository(options.dbHandle.db, options.dbHandle.region)
      : undefined);

  if (invitesRepository) {
    await fastify.register(
      invitesRoutes({
        repository: invitesRepository,
        refreshStore: refreshState.store,
        jwtSecret: env.JWT_SECRET,
        region: env.REGION,
        isProduction: env.NODE_ENV === 'production',
        ...(options.inviteNotificationEnqueuer
          ? { notificationEnqueuer: options.inviteNotificationEnqueuer }
          : {}),
        ...(options.inviteAppBaseUrl ? { appBaseUrl: options.inviteAppBaseUrl } : {}),
        ...(options.seatCeilingCheck ? { seatCeilingCheck: options.seatCeilingCheck } : {}),
      }),
      { prefix: '/api/v1' },
    );
  }

  // DSAR routes (Story 14.1). Self-service data-subject access request
  // surface. Mounts at `/api/v1/dsar`; the POST enqueues a worker job
  // that walks the erasure-cascade registry to assemble the export
  // zip + dispatches the `dsar-ready` email. Repository is in-memory
  // by default for tests; production wires DrizzleDsarRepository.
  const dsarRepository: DsarRepository | undefined =
    options.dsarRepository ??
    (options.dbHandle
      ? new DrizzleDsarRepository(options.dbHandle.db, options.dbHandle.region)
      : undefined);

  if (dsarRepository) {
    await fastify.register(
      dsarRoutes({
        repository: dsarRepository,
        ...(options.dsarExportEnqueuer ? { exportEnqueuer: options.dsarExportEnqueuer } : {}),
      }),
      { prefix: '/api/v1/dsar' },
    );
  }

  // Recordings routes — only mount when both the storage provider and
  // recordings repository are available. Tests that don't exercise the
  // upload flow omit them.
  if (options.storageProvider && recordingsRepository) {
    const transcribeEnqueuer = options.transcribeEnqueuer ?? new InMemoryTranscribeEnqueuer();
    await fastify.register(
      recordingsRoutes({
        repository: recordingsRepository,
        storage: options.storageProvider,
        transcribeEnqueuer,
        ...(options.notificationEnqueuer
          ? { notificationEnqueuer: options.notificationEnqueuer }
          : {}),
        ...(options.heartbeatStore ? { heartbeatStore: options.heartbeatStore } : {}),
      }),
      { prefix: '/api/v1/recordings' },
    );
  }

  // Bot-sessions routes (Story 9.x). Mounts the create endpoint that
  // enqueues a bot.join job for apps/bot. Always-on (no storage gate)
  // since the route only writes the row + enqueues.
  const botSessionsRepository: BotSessionsRepository | undefined =
    options.botSessionsRepository ??
    (options.dbHandle
      ? new DrizzleBotSessionsRepository(options.dbHandle.db, options.dbHandle.region)
      : undefined);
  if (botSessionsRepository) {
    const botJoinEnqueuer: BotJoinEnqueuer =
      options.botJoinEnqueuer ?? new InMemoryBotJoinEnqueuer();
    await fastify.register(
      botSessionsRoutes({ repository: botSessionsRepository, enqueuer: botJoinEnqueuer }),
      { prefix: '/api/v1/bot-sessions' },
    );
  }

  // Meetings routes (Story 2.1 follow-up) — speaker-turns + meeting-scoped
  // playback URL. Same gating as recordings: requires a storage provider
  // (for presignGet) and a meetings repository. The repository is
  // dependency-injected so tests can use the in-memory shim.
  const meetingsRepository: MeetingsRepository | undefined =
    options.meetingsRepository ??
    (options.dbHandle
      ? new DrizzleMeetingsRepository(options.dbHandle.db, options.dbHandle.region)
      : undefined);

  if (options.storageProvider && meetingsRepository) {
    await fastify.register(
      meetingsRoutes({
        repository: meetingsRepository,
        storage: options.storageProvider,
      }),
      { prefix: '/api/v1/meetings' },
    );
  }

  // Feedback routes (Story 1.7) — mounts independently of storage; the
  // thumbs prompt only writes feedback rows. Tests inject the in-memory
  // repo; production uses the Drizzle-backed implementation.
  const feedbackRepository: FeedbackRepository | undefined =
    options.feedbackRepository ??
    (options.dbHandle
      ? new DrizzleFeedbackRepository(options.dbHandle.db, options.dbHandle.region)
      : undefined);

  if (feedbackRepository) {
    await fastify.register(feedbackRoutes({ repository: feedbackRepository }), {
      prefix: '/api/v1/feedback',
    });
  }

  // Shares routes (Stories 8.1 + 8.2 + 8.3). Mounts the create / list /
  // revoke admin flow under `/api/v1/meetings/:id/shares` + the public
  // recipient view at `/api/v1/share/:token` (skipTenantContext). Needs a
  // meetings repository for transcript fetch.
  const sharesRepository: SharesRepository | undefined =
    options.sharesRepository ??
    (options.dbHandle
      ? new DrizzleSharesRepository(options.dbHandle.db, options.dbHandle.region)
      : undefined);

  if (sharesRepository && meetingsRepository) {
    const loadMeetingSummary = options.loadMeetingSummary;
    const inboundSharesRepository: InboundSharesRepository | undefined =
      options.inboundSharesRepository ??
      (options.dbHandle
        ? new DrizzleInboundSharesRepository(options.dbHandle.db, options.dbHandle.region)
        : undefined);
    await fastify.register(
      sharesRoutes({
        shares: sharesRepository,
        meetings: meetingsRepository,
        appBaseUrl: options.shareAppBaseUrl ?? 'https://app.aisecretary.app',
        ...(loadMeetingSummary ? { loadMeetingSummary } : {}),
        ...(inboundSharesRepository ? { inboundShares: inboundSharesRepository } : {}),
        ...(options.receivingTenantResolver
          ? { receivingTenantResolver: options.receivingTenantResolver }
          : {}),
        ...(options.resolveSenderTenantDomain
          ? { resolveSenderTenantDomain: options.resolveSenderTenantDomain }
          : {}),
      }),
      { prefix: '/api/v1' },
    );
  }

  // Action-items routes (Story 8.5 — My Actions roll-up). Mounted under
  // /api/v1/action-items. Read + status-update only; the worker writes
  // rows directly into `action_items` from the Story 3.3 path.
  const actionItemsRepository: ActionItemsRepository | undefined =
    options.actionItemsRepository ??
    (options.dbHandle
      ? new DrizzleActionItemsRepository(options.dbHandle.db, options.dbHandle.region)
      : undefined);

  if (actionItemsRepository) {
    await fastify.register(actionItemsRoutes({ repository: actionItemsRepository }), {
      prefix: '/api/v1/action-items',
    });
  }

  // Audit-log export route (Story 14.5 — FR54). Mounted under
  // `/api/v1/audit-export`. Tenant scoping via RLS in the repository;
  // route-level role check restricts to org_admin / super_admin.
  const auditExportRepository: AuditExportRepository | undefined =
    options.auditExportRepository ??
    (options.dbHandle
      ? new DrizzleAuditExportRepository(options.dbHandle.db, options.dbHandle.region)
      : undefined);

  if (auditExportRepository) {
    await fastify.register(auditExportRoutes({ repository: auditExportRepository }), {
      prefix: '/api/v1/audit-export',
    });
  }

  // Erasure-cascade preview route (Story 14.4 — FR53 substrate). Mounted
  // under `/api/v1/erasure-preview/:userId`. Org-admin only; counts only,
  // never mutates.
  const erasurePreviewRepository: ErasurePreviewRepository | undefined =
    options.erasurePreviewRepository ??
    (options.dbHandle
      ? new DrizzleErasurePreviewRepository(options.dbHandle.db, options.dbHandle.region)
      : undefined);

  if (erasurePreviewRepository) {
    await fastify.register(erasurePreviewRoutes({ repository: erasurePreviewRepository }), {
      prefix: '/api/v1/erasure-preview',
    });
  }

  // Search route (Story 7.2 — FR28). FTS today; semantic-hybrid lands
  // when Story 7.1 ships embeddings tables.
  const searchRepository: SearchRepository | undefined =
    options.searchRepository ??
    (options.dbHandle
      ? new DrizzleSearchRepository(options.dbHandle.db, options.dbHandle.region)
      : undefined);

  if (searchRepository) {
    await fastify.register(searchRoutes({ repository: searchRepository }), {
      prefix: '/api/v1/search',
    });

    // Chat route (Story 6.1 — RAG). Defaults: search-backed retriever
    // + deterministic mock streamer until the LLM-gateway streaming
    // path is wired here.
    const chatRetriever = options.chatRetriever ?? buildSearchBackedRetriever(searchRepository);
    const chatStreamer = options.chatStreamer ?? buildMockStreamer();
    await fastify.register(chatRoutes({ retriever: chatRetriever, streamer: chatStreamer }), {
      prefix: '/api/v1/chat',
    });
  }

  // Public DSAR portal (Story 14.3 — FR52). Auth-free routes; the
  // submission rows are routed to the named tenant's admin queue
  // post-verification. In-memory repo by default; tests inject one
  // explicitly. The verification email dispatcher is also injected;
  // the no-op default just structure-logs the dispatch so dev runs
  // don't blow up without an SMTP provider.
  const dsarPortalRepository: DsarPortalRepository =
    options.dsarPortalRepository ?? new InMemoryDsarPortalRepository();
  const dsarPortalEmailDispatcher =
    options.dsarPortalEmailDispatcher ??
    (async (input) => {
      fastify.log.info(
        { email: input.email, expiresAt: input.expiresAt.toISOString() },
        'dsar-portal: verification email (no dispatcher wired)',
      );
    });
  await fastify.register(
    dsarPortalRoutes({
      repository: dsarPortalRepository,
      dispatchVerificationEmail: dsarPortalEmailDispatcher,
    }),
    { prefix: '/api/v1/data-rights' },
  );

  // F2-admin endpoints (Story 12.1) — tenant lifecycle FSM. Org-admin
  // walks the workspace from `dpa_required` through `provisioning` to
  // `active`. Repository is in-memory by default for tests; production
  // wires the Drizzle variant when a DB handle is available.
  const tenantAdminRepository: TenantAdminRepository | undefined =
    options.tenantAdminRepository ??
    (options.dbHandle
      ? new DrizzleTenantAdminRepository(options.dbHandle.db, options.dbHandle.region)
      : undefined);

  if (tenantAdminRepository) {
    await fastify.register(tenantAdminRoutes({ repository: tenantAdminRepository }), {
      prefix: '/api/v1/tenants',
    });
  }

  // Cross-org accept-policy (Story 12.7) — receiving-tenant control.
  // In-memory repo by default; production wires the Drizzle variant
  // when a DB handle is available (the table lands as a follow-up).
  const crossOrgPolicyRepository: CrossOrgPolicyRepository =
    options.crossOrgPolicyRepository ?? new InMemoryCrossOrgPolicyRepository();
  await fastify.register(crossOrgPolicyRoutes({ repository: crossOrgPolicyRepository }), {
    prefix: '/api/v1/tenants/me/cross-org-policy',
  });

  // OAuth routes (Story 1.5b). Mounted under /api/v1/auth so the
  // provider redirect URI sits next to the email/password auth surface.
  // When neither Google nor Microsoft credentials are set, the routes
  // still register but every request returns 503 — keeps the URL
  // contract stable so clients can detect "OAuth not yet configured"
  // cleanly.
  await fastify.register(
    oauthRoutes({
      providers: oauthProvidersFromEnv(env),
      redirectBaseUrl: env.OAUTH_REDIRECT_BASE_URL,
      exchange: options.oauthExchange ?? noopOauthExchange,
    }),
    { prefix: '/api/v1/auth' },
  );

  await fastify.register(auditCoverageFixtureRoutes);

  await fastify.ready();
  return fastify;
};

/** Helper for the production entry point — boots a DB handle from env. */
export const buildProductionServer = async (): Promise<FastifyInstance> => {
  const env = loadEnv();
  const dbHandle = createDbHandle({
    databaseUrl: env.DATABASE_URL,
    region: env.REGION,
  });
  return await buildServer({ env, dbHandle });
};
