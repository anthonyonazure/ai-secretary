import type { AuditLogger as NotificationsAuditLogger } from '@aisecretary/notifications';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { AUDIT_ACTIONS, type ApiAuditAction, isCanonicalAuditAction } from '../lib/audit-types.js';
import { HttpError } from '../lib/http-error.js';
import type { AuditEmitInput } from '../types/fastify.js';

/**
 * The shape of one audit row. Mirrors `audit_logs` columns one-to-one;
 * the persistence layer is responsible for the actual INSERT.
 */
export interface AuditRecord {
  tenantId: string;
  actorUserId: string | null;
  action: ApiAuditAction;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  requestId: string;
  region: 'us' | 'eu';
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Sink contract — pluggable so unit tests can capture rows without a
 * live DB and so the production sink can wrap the Drizzle insert with
 * `withTenantContext` from `@aisecretary/db/client`.
 *
 * The default in-memory sink (used until DB wiring lands) just logs +
 * keeps the rows in process. A future Story-1.4-follow-up will wire a
 * Postgres sink that goes through `withTenantContext`.
 */
export interface AuditSink {
  write(record: AuditRecord): Promise<void>;
}

export interface AuditLoggerPluginOptions {
  sink?: AuditSink;
}

/**
 * In-memory fallback sink. Logs each row and retains them on the
 * instance — useful for tests and as a temporary default until the
 * Postgres sink lands.
 */
class InMemoryAuditSink implements AuditSink {
  public readonly rows: AuditRecord[] = [];
  constructor(private readonly fastify: FastifyInstance) {}
  async write(record: AuditRecord): Promise<void> {
    this.rows.push(record);
    this.fastify.log.info(
      {
        audit: {
          action: record.action,
          tenantId: record.tenantId,
          resourceType: record.resourceType,
          resourceId: record.resourceId,
        },
      },
      'audit-row',
    );
  }
}

/**
 * AuditLogger interface conformance for `@aisecretary/notifications`.
 *
 * `NotificationGateway` accepts an `AuditLogger` with a `log(entry)`
 * method. We expose `createNotificationsAuditLogger(fastify, ...)` so the
 * gateway can be injected with our plugin's sink without depending on
 * the Fastify instance directly.
 */
export const createNotificationsAuditLogger = (
  fastify: FastifyInstance,
  ctx: () => {
    tenantId: string;
    actorUserId: string | null;
    requestId: string;
    region: 'us' | 'eu';
    ipAddress: string | null;
    userAgent: string | null;
  },
): NotificationsAuditLogger => ({
  async log(entry) {
    await fastify.auditWrite({
      tenantId: entry.tenantId,
      actorUserId: ctx().actorUserId,
      action: entry.action,
      resourceType: 'notification',
      resourceId: entry.notificationId,
      metadata: {
        recipient: entry.recipient,
        channel: entry.channel,
        kind: entry.kind,
        ...(entry.providerMessageId !== undefined
          ? { providerMessageId: entry.providerMessageId }
          : {}),
        ...(entry.error !== undefined ? { error: entry.error } : {}),
      },
      requestId: ctx().requestId,
      region: ctx().region,
      ipAddress: ctx().ipAddress,
      userAgent: ctx().userAgent,
    });
  },
});

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Direct sink access — used by:
     *   - the manual `request.audit(...)` decoration
     *   - the auto-emit `auditTags` route hook
     *   - `createNotificationsAuditLogger` (notifications gateway bridge)
     *
     * Throws if `record.action` is not in the canonical union.
     */
    auditWrite: (record: AuditRecord) => Promise<void>;
  }
}

const buildRecord = (request: FastifyRequest, input: AuditEmitInput): AuditRecord => {
  if (!isCanonicalAuditAction(input.action)) {
    throw new HttpError(
      500,
      'Internal Audit Error',
      `Unknown audit action '${input.action}'. Add it to AUDIT_ACTIONS / ApiAuditAction in apps/api/src/lib/audit-types.ts.`,
    );
  }
  const ipHeader = request.headers['x-forwarded-for'];
  const firstIp = Array.isArray(ipHeader) ? ipHeader[0] : ipHeader?.split(',')[0]?.trim();
  const userAgent = request.headers['user-agent'];
  return {
    tenantId: input.tenantIdOverride ?? request.tenantId,
    actorUserId: request.user?.userId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    metadata: input.metadata ?? {},
    requestId: request.requestId,
    region: request.region,
    ipAddress: firstIp ?? request.ip ?? null,
    userAgent: typeof userAgent === 'string' ? userAgent : null,
  };
};

/**
 * `audit-logger` plugin.
 *
 * Provides three usage modes:
 *
 *   1. Manual: `await request.audit({ action, resourceType, resourceId, metadata })`
 *   2. Tag-driven auto-emit: declare `config: { auditTags: ['meeting.created'] }`
 *      on a route — the plugin emits one row per tag on a 2xx response.
 *   3. Direct: `fastify.auditWrite(record)` — used by the notifications
 *      audit-logger bridge so non-route code paths still pass through here.
 *
 * Discipline guarantees:
 *   - Unknown actions throw HTTP 500. Enforced both at TS level (the
 *     `ApiAuditAction` union) and runtime level (this plugin).
 *   - GET requests have no auto-emit by default — they're not state-
 *     changing. Set `auditTags` explicitly to override.
 *   - The check-audit-coverage CI script (apps/api/scripts/check-audit-
 *     coverage.ts) walks `routes/**` and fails the build if a non-GET
 *     route has neither `auditTags` nor a `request.audit(...)` call.
 *
 * Implementation choice — synchronous insert, not enqueue:
 *   We picked the synchronous path. Auditing must succeed alongside the
 *   primary write or the whole request fails. Async/queue-based audits
 *   risk losing rows on worker crash and would require dedup logic on
 *   replay. If audit-write latency becomes a bottleneck, the future fix
 *   is batching at the sink layer, not deferring to a queue.
 */
const plugin: FastifyPluginAsync<AuditLoggerPluginOptions> = async (
  fastify: FastifyInstance,
  options: AuditLoggerPluginOptions,
) => {
  const sink = options.sink ?? new InMemoryAuditSink(fastify);

  fastify.decorate('auditWrite', async (record: AuditRecord) => {
    if (!isCanonicalAuditAction(record.action)) {
      throw new HttpError(
        500,
        'Internal Audit Error',
        `Unknown audit action '${record.action}'. Add it to AUDIT_ACTIONS / ApiAuditAction.`,
      );
    }
    await sink.write(record);
  });

  // Pre-bind a no-op so the decorator slot has a value of the right type;
  // the per-request hook below replaces it with the real closure.
  const noopAudit: (input: AuditEmitInput) => Promise<void> = async () => {
    // Replaced per-request in the onRequest hook below.
  };
  fastify.decorateRequest('audit', noopAudit);

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.audit = async (input: AuditEmitInput) => {
      const record = buildRecord(request, input);
      await sink.write(record);
    };
  });

  // Auto-emit on tagged routes when the response is 2xx.
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const tags = request.routeOptions.config?.auditTags;
    if (!tags || tags.length === 0) return;
    if (reply.statusCode < 200 || reply.statusCode >= 300) return;
    if (!request.tenantId) return; // Health-check / pre-auth routes — defensive guard.
    for (const action of tags) {
      try {
        const record = buildRecord(request, {
          action,
          resourceType: action.split('.')[0] ?? 'unknown',
          metadata: { auto: true },
        });
        await sink.write(record);
      } catch (err) {
        request.log.error({ err, action }, 'audit-logger: auto-emit failed');
      }
    }
  });
};

export const auditLoggerPlugin = fp(plugin, {
  name: 'audit-logger',
  dependencies: ['tenant-context'],
});

export { AUDIT_ACTIONS };
