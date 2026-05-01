/**
 * F2-admin endpoints — Story 12.1 (FR72 substrate).
 *
 *   GET  /api/v1/tenants/me/state  — onboarding-progress source of truth
 *   POST /api/v1/tenants/me/dpa    — accept the data-processing addendum
 *   POST /api/v1/tenants/me/region — one-shot region pin
 *
 * Auth + RLS:
 *   - org_admin or super_admin only — onboarding actions
 *   - tenant scoping enforced via RLS in the repository
 *   - region-pin is idempotent at the API layer (returns 409 on a
 *     second call) AND at the DB layer via the `enforce_region_lock`
 *     trigger
 *
 * Audit:
 *   - DPA accept emits `tenant.dpa-accepted`
 *   - Region pin emits `tenant.region-pinned`
 *
 * Follow-ups (12.x sprint):
 *   - tenant_settings PATCH (disclosure / retention / cross-org policy)
 *   - integrations consolidation (Story 12.2)
 *   - audit-log table viewer (Story 12.5)
 */

import {
  type TenantStateResponse,
  acceptDpaRequestSchema,
  pinRegionRequestSchema,
  tenantStateResponseSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../lib/http-error.js';
import { requireRole } from '../lib/role-check.js';
import { RegionAlreadyPinnedError, type TenantAdminRepository } from './tenant-admin-repository.js';

export interface TenantAdminRoutesOptions {
  repository: TenantAdminRepository;
}

const requireAuth = (request: FastifyRequest): { userId: string; tenantId: string } => {
  if (!request.user) throw new UnauthorizedError('Authentication required.');
  if (!request.tenantId) throw new ForbiddenError('Tenant context missing.');
  return { userId: request.user.userId, tenantId: request.tenantId };
};

const buildStateResponse = (row: {
  id: string;
  state: TenantStateResponse['state'];
  region: TenantStateResponse['region'];
  dpaAcceptedAt: Date | null;
  regionLockedAt: Date | null;
}): TenantStateResponse => {
  const dpaAccepted = row.dpaAcceptedAt !== null;
  const regionPinned = row.regionLockedAt !== null;
  const completedSteps: TenantStateResponse['completedSteps'] = [];
  if (dpaAccepted) completedSteps.push('dpa');
  if (regionPinned) completedSteps.push('region');
  return {
    tenantId: row.id,
    state: row.state,
    dpaAccepted,
    regionPinned,
    region: row.region,
    completedSteps,
  };
};

export const tenantAdminRoutes = (options: TenantAdminRoutesOptions): FastifyPluginAsync => {
  return async (fastify) => {
    fastify.get(
      '/me/state',
      {
        preHandler: [requireRole(['super_admin', 'org_admin'])],
        config: { skipAudit: true },
      },
      async (request, reply) => {
        const { tenantId } = requireAuth(request);
        const row = await options.repository.findState(tenantId);
        if (!row) throw new NotFoundError('Tenant not found.');
        const body = buildStateResponse(row);
        return reply.status(200).send(tenantStateResponseSchema.parse(body));
      },
    );

    fastify.post(
      '/me/dpa',
      {
        preHandler: [requireRole(['super_admin', 'org_admin'])],
        config: { auditTags: ['tenant.dpa-accepted'] },
      },
      async (request, reply) => {
        const { tenantId, userId } = requireAuth(request);
        const parsed = acceptDpaRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid DPA acceptance payload.',
          );
        }
        const row = await options.repository.acceptDpa({
          tenantId,
          userId,
          dpaVersion: parsed.data.dpaVersion,
        });
        return reply.status(200).send(tenantStateResponseSchema.parse(buildStateResponse(row)));
      },
    );

    fastify.post(
      '/me/region',
      {
        preHandler: [requireRole(['super_admin', 'org_admin'])],
        config: { auditTags: ['tenant.region-pinned'] },
      },
      async (request, reply) => {
        const { tenantId } = requireAuth(request);
        const parsed = pinRegionRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid region-pin payload.',
          );
        }
        try {
          const row = await options.repository.pinRegion({
            tenantId,
            region: parsed.data.region,
          });
          return reply.status(200).send(tenantStateResponseSchema.parse(buildStateResponse(row)));
        } catch (err) {
          if (err instanceof RegionAlreadyPinnedError) {
            throw new ConflictError(err.message);
          }
          throw err;
        }
      },
    );
  };
};
