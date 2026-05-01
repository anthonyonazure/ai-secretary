/**
 * Feedback routes — Story 1.7.
 *
 * Mount path: `/api/v1/feedback` (set by `buildServer()` via `prefix`).
 *
 * Captures the per-meeting thumbs-up / thumbs-down receipt prompt that
 * the first-three-receipt polish surface raises (UX spec § F2 user
 * first-launch flow). One row per (user, meeting); duplicate inserts
 * return 409 conflict.
 */

import {
  type RecordThumbsResponse,
  recordThumbsRequestSchema,
  recordThumbsResponseSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../lib/http-error.js';
import { type FeedbackRepository, FeedbackThumbsConflictError } from './feedback-repository.js';

export interface FeedbackRoutesOptions {
  repository: FeedbackRepository;
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

export const feedbackRoutes = (options: FeedbackRoutesOptions): FastifyPluginAsync => {
  return async (fastify) => {
    fastify.post(
      '/thumbs',
      {
        config: {
          auditTags: ['feedback.thumbs-recorded'],
        },
      },
      async (request, reply) => {
        const { userId, tenantId } = requireUser(request);
        const parsed = recordThumbsRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid feedback payload.',
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

        try {
          const row = await options.repository.recordThumbs({
            tenantId,
            userId,
            meetingId: parsed.data.meetingId,
            response: parsed.data.response,
            ...(parsed.data.context !== undefined ? { context: parsed.data.context } : {}),
          });
          const body: RecordThumbsResponse = {
            id: row.id,
            meetingId: row.meetingId,
            response: row.response,
            context: row.context as RecordThumbsResponse['context'],
            createdAt: row.createdAt.toISOString(),
          };
          return reply.status(201).send(recordThumbsResponseSchema.parse(body));
        } catch (err) {
          if (err instanceof FeedbackThumbsConflictError) {
            throw new ConflictError('Feedback already recorded for this meeting.');
          }
          throw err;
        }
      },
    );
  };
};
