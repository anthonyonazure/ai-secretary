/**
 * Bot-sessions routes — Story 9.x (chunk 3).
 *
 * Mount path: `/api/v1/bot-sessions` (set by `buildServer()` via prefix).
 *
 * Lifecycle:
 *   POST /                 → row created (status='provisioning'),
 *                            audit emitted (`bot.session.provisioned`),
 *                            `bot.join` job enqueued for `apps/bot`.
 *
 * The session row's downstream FSM transitions (joined / ended /
 * failed) are emitted by `apps/bot/src/handlers/bot-join.ts` directly
 * against the audit sink — they do NOT pass through this route, so
 * the audit-coverage script's `auditTags` mechanism only flags
 * `bot.session.provisioned` for this surface.
 *
 * `external_meeting_passcode` is write-only — the response shape never
 * includes it. The repository's read path (`findById` / `list`) also
 * never returns it.
 */

import {
  type BotSessionResponse,
  type CreateBotSessionRequest,
  botSessionResponseSchema,
  createBotSessionRequestSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import type { BotJoinEnqueuer } from '../lib/bot-join-enqueue.js';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../lib/http-error.js';
import type { BotSessionRow, BotSessionsRepository } from './bot-sessions-repository.js';

export interface BotSessionsRoutesOptions {
  repository: BotSessionsRepository;
  enqueuer: BotJoinEnqueuer;
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

const rowToResponse = (row: BotSessionRow): BotSessionResponse => ({
  sessionId: row.id,
  meetingId: row.meetingId,
  source: row.source,
  status: row.status,
  region: row.region,
  externalMeetingId: row.externalMeetingId,
  joinedAt: row.joinedAt ? row.joinedAt.toISOString() : null,
  endedAt: row.endedAt ? row.endedAt.toISOString() : null,
  failureReason: row.failureReason,
  createdAt: row.createdAt.toISOString(),
});

export const botSessionsRoutes = (options: BotSessionsRoutesOptions): FastifyPluginAsync => {
  return async (fastify) => {
    fastify.post(
      '/',
      {
        config: {
          auditTags: ['bot.session.provisioned'],
        },
      },
      async (request, reply) => {
        const { userId, tenantId } = requireUser(request);

        const parsed = createBotSessionRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid bot-session payload',
            {
              extensions: {
                errors: parsed.error.issues.map((i) => ({
                  path: i.path.join('.'),
                  message: i.message,
                  code: i.code,
                })),
              },
            },
          );
        }
        const body: CreateBotSessionRequest = parsed.data;

        const row = await options.repository.create({
          tenantId,
          ownerUserId: userId,
          source: body.source,
          region: request.region,
          externalMeetingId: body.externalMeetingId,
          meetingId: body.meetingId ?? null,
          ...(body.externalMeetingPasscode !== undefined
            ? { externalMeetingPasscode: body.externalMeetingPasscode }
            : {}),
        });

        await options.enqueuer.enqueue({
          sessionId: row.id,
          tenantId: row.tenantId,
          region: row.region,
        });

        return reply.status(201).send(botSessionResponseSchema.parse(rowToResponse(row)));
      },
    );
  };
};
