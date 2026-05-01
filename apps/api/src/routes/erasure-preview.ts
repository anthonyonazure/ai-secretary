/**
 * Erasure-cascade preview route — Story 14.4 (FR53 substrate).
 *
 * Mount path: `/api/v1/erasure-preview` (set by `buildServer()` via prefix).
 *
 *   GET /:userId → cascade-scope preview for the named user
 *
 * Auth + RLS:
 *   - org_admin or super_admin only — destructive op preview
 *   - tenant scoping enforced via RLS in the repository
 *
 * The route walks the canonical erasure-cascade registry (passed in
 * from `apps/api/src/lib/erasure-cascade.ts`) and asks the repository
 * for per-table row counts WITHOUT mutating. The admin UI consumes
 * this payload to render the confirmation step.
 *
 * Read-only — `skipAudit: true`.
 */

import {
  type ErasurePreviewResponse,
  type ErasurePreviewStage,
  erasurePreviewResponseSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ERASURE_CASCADE } from '../lib/erasure-cascade.js';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../lib/http-error.js';
import { requireRole } from '../lib/role-check.js';
import type {
  CascadeEntryInput,
  ErasurePreviewRepository,
  PreviewStage,
} from './erasure-preview-repository.js';

export interface ErasurePreviewRoutesOptions {
  repository: ErasurePreviewRepository;
  /** Test seam — defaults to the canonical registry. */
  cascade?: readonly CascadeEntryInput[];
}

const requireAuth = (request: FastifyRequest): { tenantId: string } => {
  if (!request.user) throw new UnauthorizedError('Authentication required.');
  if (!request.tenantId) throw new ForbiddenError('Tenant context missing.');
  return { tenantId: request.tenantId };
};

const userIdParamSchema = z.object({ userId: z.string().uuid() });

const toWireStage = (stage: PreviewStage): ErasurePreviewStage => ({
  table: stage.table,
  strategy: stage.strategy,
  action: stage.action,
  rowCount: stage.rowCount,
  ...(stage.note !== undefined ? { note: stage.note } : {}),
});

export const erasurePreviewRoutes = (options: ErasurePreviewRoutesOptions): FastifyPluginAsync => {
  const cascade =
    options.cascade ?? ERASURE_CASCADE.map((e) => ({ table: e.table, strategy: e.strategy }));

  return async (fastify) => {
    fastify.get<{ Params: { userId: string } }>(
      '/:userId',
      {
        preHandler: [requireRole(['super_admin', 'org_admin'])],
        config: { skipAudit: true },
      },
      async (request, reply) => {
        const { tenantId } = requireAuth(request);
        const params = userIdParamSchema.safeParse(request.params);
        if (!params.success) {
          throw new ValidationError('userId must be a valid UUID.');
        }

        const result = await options.repository.preview(cascade, {
          tenantId,
          userId: params.data.userId,
        });

        const body: ErasurePreviewResponse = {
          scope: result.scope,
          totalRowsAffected: result.totalRowsAffected,
          fullyHandled: result.fullyHandled,
          stages: result.stages.map(toWireStage),
        };
        return reply.status(200).send(erasurePreviewResponseSchema.parse(body));
      },
    );
  };
};
