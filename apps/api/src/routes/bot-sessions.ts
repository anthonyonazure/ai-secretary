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
  type BotSessionListResponse,
  type BotSessionResponse,
  type CreateBotSessionRequest,
  botSessionListResponseSchema,
  botSessionResponseSchema,
  createBotSessionRequestSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { BotJoinEnqueuer } from '../lib/bot-join-enqueue.js';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../lib/http-error.js';
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

const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid(),
});

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
  cursor: z.string().min(1).optional(),
  meetingId: z.string().uuid().optional(),
  /** Restrict to the caller's own sessions. Defaults to true when omitted. */
  mineOnly: z.coerce.boolean().optional(),
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

    /**
     * GET /:sessionId — fetch a single bot session.
     *
     * Tenant-scoped: the repository's `findById` already filters by
     * `tenantId`, so a cross-tenant probe yields 404 (not 403) — same
     * convention the meetings route uses to avoid leaking existence.
     *
     * No `requireConsent` gate — the bot session row is metadata about
     * the caller's own join attempt, not recorded content. Per-meeting
     * playback / transcript routes carry their own consent checks.
     */
    fastify.get<{ Params: { sessionId: string } }>(
      '/:sessionId',
      {
        config: { skipAudit: true },
      },
      async (request, reply) => {
        const { tenantId } = requireUser(request);
        const parsed = sessionIdParamSchema.safeParse(request.params);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'sessionId must be a valid UUID',
          );
        }
        const row = await options.repository.findById(parsed.data.sessionId, tenantId);
        if (!row) {
          throw new NotFoundError(`Bot session ${parsed.data.sessionId} not found.`);
        }
        return reply.status(200).send(botSessionResponseSchema.parse(rowToResponse(row)));
      },
    );

    /**
     * GET / — paginated list of bot sessions for the current tenant.
     *
     * Query params:
     *   - `limit`     — page size (default 20, max 100)
     *   - `cursor`    — base64 token from a previous `nextCursor`
     *   - `meetingId` — restrict to a single meeting (drives the
     *                    meeting-detail bot-status badge)
     *   - `mineOnly`  — when true (default), restrict to the caller's
     *                    own sessions; admins can pass `mineOnly=false`
     *                    to see every session in the tenant.
     */
    fastify.get<{
      Querystring: { limit?: string; cursor?: string; meetingId?: string; mineOnly?: string };
    }>(
      '/',
      {
        config: { skipAudit: true },
      },
      async (request, reply) => {
        const { userId, tenantId } = requireUser(request);
        const parsed = listQuerySchema.safeParse(request.query ?? {});
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid list-bot-sessions query.',
          );
        }
        const { limit, cursor, meetingId, mineOnly } = parsed.data;
        const restrictToCaller = mineOnly ?? true;
        const result = await options.repository.list({
          tenantId,
          ...(restrictToCaller ? { ownerUserId: userId } : {}),
          ...(meetingId ? { meetingId } : {}),
          limit,
          cursor: cursor ?? null,
        });

        const body: BotSessionListResponse = {
          items: result.items.map((r) => rowToResponse(r)),
          nextCursor: result.nextCursor,
          totalCount: result.totalCount,
        };
        return reply.status(200).send(botSessionListResponseSchema.parse(body));
      },
    );
  };
};
