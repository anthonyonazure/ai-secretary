/**
 * Self-service DSAR routes — Story 14.1.
 *
 * Mount path: `/api/v1/dsar` (set by `buildServer()` via `prefix`).
 *
 *   POST   /api/v1/dsar/requests        # auth required — creates queued request
 *   GET    /api/v1/dsar/requests        # auth required — list authed user's history
 *   GET    /api/v1/dsar/requests/:id    # auth required — single request status
 *
 * POST contract:
 *   - Idempotent: if the user already has a `queued` or `processing`
 *     request, the existing row is returned with status 200 (instead of
 *     creating a new one with 202).
 *   - Otherwise insert a new row, enqueue `dsar.export` pg-boss job,
 *     return 202.
 *   - `expires_at` is set to `now() + 7d`. The worker uses this as the
 *     soft-expiry; a future cron flips status='expired' once elapsed
 *     (added in a follow-up; out of scope for 14.1).
 *
 * Audit:
 *   - POST emits `dsar.requested` (auto-tag).
 *   - The worker emits `dsar.export-completed` / `dsar.export-failed`
 *     via the worker-side audit-logger (TODO: shared with the
 *     transcribe handler — see Story 1.4 follow-up). For Story 14.1
 *     the worker logs the action and metadata to its pino logger; a
 *     proper audit row lands once the worker-side audit plugin ships.
 *
 * The `dsar.zip-downloaded` action is intentionally NOT modelled — the
 * presigned-GET URL goes directly to S3 and the API never observes the
 * download.
 */

import {
  type CreateDsarRequestResponse,
  type DsarRequestWire,
  type DsarRequestsListResponse,
  createDsarRequestResponseSchema,
  dsarRequestSchema,
  dsarRequestsListResponseSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../lib/http-error.js';
import type { DsarRepository, DsarRequestRow } from './dsar-repository.js';

/**
 * Worker enqueue seam — the route layer hands this off to a pg-boss
 * publisher in production and an in-memory capture in tests. Mirrors
 * the InviteNotificationEnqueuer / TranscribeEnqueuer pattern.
 */
export interface DsarExportEnqueuer {
  enqueue(payload: DsarExportJobPayload): Promise<string | null>;
}

export interface DsarExportJobPayload {
  requestId: string;
  tenantId: string;
  userId: string;
  region: 'us' | 'eu';
}

/** Default in-memory enqueuer — tests + dev. */
export class InMemoryDsarExportEnqueuer implements DsarExportEnqueuer {
  public readonly jobs: Array<{ id: string; payload: DsarExportJobPayload }> = [];
  private counter = 0;

  async enqueue(payload: DsarExportJobPayload): Promise<string | null> {
    this.counter += 1;
    const id = `dsar-export-${this.counter}`;
    this.jobs.push({ id, payload });
    return id;
  }
}

export const DSAR_EXPORT_QUEUE = 'dsar.export' as const;

/** pg-boss-backed enqueuer — production wires this in `buildProductionServer()`. */
export class PgBossDsarExportEnqueuer implements DsarExportEnqueuer {
  // biome-ignore lint/suspicious/noExplicitAny: pg-boss is the only consumer of this seam in production.
  constructor(private readonly boss: { send(name: string, data: unknown): Promise<any> }) {}

  async enqueue(payload: DsarExportJobPayload): Promise<string | null> {
    const id = await this.boss.send(DSAR_EXPORT_QUEUE, payload);
    return id ?? null;
  }
}
const REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ESTIMATED_READY_MS = 24 * 60 * 60 * 1000;

export interface DsarRoutesOptions {
  repository: DsarRepository;
  /**
   * Optional. When provided, a successful POST enqueues a `dsar.export`
   * job. Tests typically inject `InMemoryDsarExportEnqueuer`. Production
   * wires a real PgBoss-backed enqueuer at server boot.
   */
  exportEnqueuer?: DsarExportEnqueuer;
}

const requireUser = (request: FastifyRequest): { userId: string; tenantId: string } => {
  if (!request.user) {
    throw new UnauthorizedError('Authentication required.');
  }
  if (!request.tenantId) {
    throw new ForbiddenError('Tenant context missing.');
  }
  return { userId: request.user.userId, tenantId: request.tenantId };
};

const dsarRowToWire = (row: DsarRequestRow): DsarRequestWire => ({
  id: row.id,
  status: row.status,
  downloadUrl: row.downloadUrl,
  downloadExpiresAt: row.downloadExpiresAt ? row.downloadExpiresAt.toISOString() : null,
  sizeBytes: row.sizeBytes,
  failureReason: row.failureReason,
  createdAt: row.createdAt.toISOString(),
  readyAt: row.readyAt ? row.readyAt.toISOString() : null,
  expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
});

/**
 * Build the create-response envelope (the 202 / 200 POST shape).
 */
const buildCreateResponse = (row: DsarRequestRow): CreateDsarRequestResponse => ({
  requestId: row.id,
  status: row.status,
  estimatedReadyAt: new Date(row.createdAt.getTime() + ESTIMATED_READY_MS).toISOString(),
});

export const dsarRoutes = (options: DsarRoutesOptions): FastifyPluginAsync => {
  return async (fastify) => {
    fastify.post(
      '/requests',
      {
        config: {
          auditTags: ['dsar.requested'],
        },
      },
      async (request, reply) => {
        const { userId, tenantId } = requireUser(request);

        // Idempotency — return the active request if one exists.
        const active = await options.repository.findActiveForUser(tenantId, userId);
        if (active) {
          return reply
            .status(200)
            .send(createDsarRequestResponseSchema.parse(buildCreateResponse(active)));
        }

        const expiresAt = new Date(Date.now() + REQUEST_TTL_MS);
        const created = await options.repository.create({ tenantId, userId, expiresAt });

        if (options.exportEnqueuer) {
          try {
            await options.exportEnqueuer.enqueue({
              requestId: created.id,
              tenantId,
              userId,
              region: request.region,
            });
          } catch (err) {
            // Log + leave the row in 'queued' state. A follow-up
            // sweeper can re-enqueue stalled rows; we deliberately do
            // not fail the request here because the row is the legal
            // receipt — the user has filed; the system owes the export.
            request.log.warn(
              { err, requestId: created.id, userId, tenantId },
              'dsar: failed to enqueue export job',
            );
          }
        } else {
          request.log.warn(
            { requestId: created.id },
            'dsar: no exportEnqueuer wired — export will not run automatically',
          );
        }

        return reply
          .status(202)
          .send(createDsarRequestResponseSchema.parse(buildCreateResponse(created)));
      },
    );

    fastify.get(
      '/requests',
      {
        config: { skipAudit: true },
      },
      async (request, reply) => {
        const { userId, tenantId } = requireUser(request);
        const rows = await options.repository.findByUser(tenantId, userId);
        const body: DsarRequestsListResponse = {
          items: rows.map(dsarRowToWire),
        };
        return reply.status(200).send(dsarRequestsListResponseSchema.parse(body));
      },
    );

    fastify.get<{ Params: { id: string } }>(
      '/requests/:id',
      {
        config: { skipAudit: true },
      },
      async (request, reply) => {
        const { userId, tenantId } = requireUser(request);
        const { id } = request.params;
        const row = await options.repository.findById(tenantId, id);
        if (!row || row.userId !== userId) {
          // Cross-user reads inside the same tenant return 404 — DSAR
          // history is private to the requester. Cross-tenant reads
          // are blocked by RLS at the DB layer; the same shape is
          // surfaced at the API.
          throw new NotFoundError(`DSAR request ${id} not found.`);
        }
        return reply.status(200).send(dsarRequestSchema.parse(dsarRowToWire(row)));
      },
    );
  };
};
