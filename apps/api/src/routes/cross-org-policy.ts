/**
 * Cross-org accept-policy route — Story 12.7 (FR74).
 *
 * Mount path: `/api/v1/tenants/me/cross-org-policy`.
 *
 *   GET    /  → current policy
 *   PUT    /  → upsert (accept-all | whitelist | block-all)
 *
 * Auth: org_admin / super_admin only — destructive op for cross-org
 * data flows. Tenant scoping via RLS in the repository.
 *
 * Audit: `share.cross-org-policy-updated` on PUT.
 */

import {
  type CrossOrgPolicyResponse,
  crossOrgPolicyResponseSchema,
  updateCrossOrgPolicyRequestSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { ForbiddenError, UnauthorizedError, ValidationError } from '../lib/http-error.js';
import { requireRole } from '../lib/role-check.js';
import type { CrossOrgPolicyRepository, CrossOrgPolicyRow } from './cross-org-policy-repository.js';

export interface CrossOrgPolicyRoutesOptions {
  repository: CrossOrgPolicyRepository;
}

const requireAuth = (request: FastifyRequest): { tenantId: string } => {
  if (!request.user) throw new UnauthorizedError('Authentication required.');
  if (!request.tenantId) throw new ForbiddenError('Tenant context missing.');
  return { tenantId: request.tenantId };
};

const toWire = (row: CrossOrgPolicyRow): CrossOrgPolicyResponse => ({
  kind: row.kind,
  whitelist: row.whitelist,
  updatedAt: row.updatedAt.toISOString(),
});

export const crossOrgPolicyRoutes = (options: CrossOrgPolicyRoutesOptions): FastifyPluginAsync => {
  return async (fastify) => {
    fastify.get(
      '/',
      {
        preHandler: [requireRole(['super_admin', 'org_admin'])],
        config: { skipAudit: true },
      },
      async (request, reply) => {
        const { tenantId } = requireAuth(request);
        const row = await options.repository.findByTenantId(tenantId);
        return reply.status(200).send(crossOrgPolicyResponseSchema.parse(toWire(row)));
      },
    );

    fastify.put(
      '/',
      {
        preHandler: [requireRole(['super_admin', 'org_admin'])],
        config: { auditTags: ['share.cross-org-policy-updated'] },
      },
      async (request, reply) => {
        const { tenantId } = requireAuth(request);
        const parsed = updateCrossOrgPolicyRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid cross-org-policy payload.',
          );
        }
        if (
          parsed.data.kind === 'whitelist' &&
          (!parsed.data.whitelist || parsed.data.whitelist.length === 0)
        ) {
          throw new ValidationError('Whitelist policy requires at least one domain.');
        }
        const row = await options.repository.upsert({
          tenantId,
          kind: parsed.data.kind,
          ...(parsed.data.whitelist ? { whitelist: parsed.data.whitelist } : {}),
        });
        return reply.status(200).send(crossOrgPolicyResponseSchema.parse(toWire(row)));
      },
    );
  };
};
