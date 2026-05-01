/**
 * Action-items routes — Story 8.5 ("My Actions" cross-meeting roll-up).
 *
 * Mount path: `/api/v1/action-items` (set by `buildServer()` via `prefix`).
 *
 *   GET /                  → cross-meeting list with filters
 *   PATCH /:id             → update status (one-tap mark-done from the UI)
 *
 * The UI ships at `/actions` on the web app; this is its server-side
 * surface. The list joins `action_items` against `meetings` for the
 * source-meeting backlink shape (id + title + recordedAt) so the web
 * client renders the link without a second request.
 */

import {
  type ActionItemRow,
  type ListActionItemsResponse,
  listActionItemsQuerySchema,
  listActionItemsResponseSchema,
  updateActionItemStatusRequestSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../lib/http-error.js';
import {
  type ActionItemListRow,
  ActionItemNotFoundError,
  type ActionItemsRepository,
} from './action-items-repository.js';

export interface ActionItemsRoutesOptions {
  repository: ActionItemsRepository;
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

const idParamSchema = z.object({ id: z.string().uuid() });

const toWire = (row: ActionItemListRow): ActionItemRow => ({
  id: row.id,
  meetingId: row.meetingId,
  meetingTitle: row.meetingTitle,
  meetingRecordedAt: row.meetingRecordedAt ? row.meetingRecordedAt.toISOString() : null,
  text: row.text,
  ownerName: row.ownerName,
  ownerUserId: row.ownerUserId,
  dueDate: row.dueDate ? row.dueDate.toISOString() : null,
  status: row.status,
  confidence: row.confidence,
  citations: row.citations,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const actionItemsRoutes = (options: ActionItemsRoutesOptions): FastifyPluginAsync => {
  return async (fastify) => {
    fastify.get(
      '/',
      {
        config: { skipAudit: true },
      },
      async (request, reply) => {
        const { tenantId } = requireUser(request);
        const parsed = listActionItemsQuerySchema.safeParse(request.query ?? {});
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid action-items query.',
          );
        }
        const { status, meetingId, dueBefore, cursor, limit } = parsed.data;
        const result = await options.repository.list({
          tenantId,
          ...(status ? { status } : {}),
          ...(meetingId ? { meetingId } : {}),
          ...(dueBefore ? { dueBefore: new Date(dueBefore) } : {}),
          cursor: cursor ?? null,
          limit,
        });
        const body: ListActionItemsResponse = {
          items: result.items.map(toWire),
          nextCursor: result.nextCursor,
          totalCount: result.totalCount,
        };
        return reply.status(200).send(listActionItemsResponseSchema.parse(body));
      },
    );

    fastify.patch<{ Params: { id: string } }>(
      '/:id',
      {
        config: { auditTags: ['action-item.status-updated'] },
      },
      async (request, reply) => {
        const { tenantId } = requireUser(request);
        const params = idParamSchema.safeParse(request.params);
        if (!params.success) {
          throw new ValidationError('id must be a valid UUID.');
        }
        const body = updateActionItemStatusRequestSchema.safeParse(request.body);
        if (!body.success) {
          throw new ValidationError(
            body.error.issues[0]?.message ?? 'Invalid action-item update payload.',
          );
        }

        try {
          const row = await options.repository.updateStatus({
            tenantId,
            id: params.data.id,
            status: body.data.status,
          });
          return reply.status(200).send(toWire(row));
        } catch (err) {
          if (err instanceof ActionItemNotFoundError) {
            throw new NotFoundError(err.message);
          }
          throw err;
        }
      },
    );
  };
};
