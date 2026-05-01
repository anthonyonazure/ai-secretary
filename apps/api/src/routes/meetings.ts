/**
 * Meetings routes — Story 2.1 follow-up.
 *
 * Mount path: `/api/v1/meetings` (set by `buildServer()` via `prefix`).
 *
 * Read-only endpoints that surface meeting-scoped artifacts (transcript +
 * playback URL) for the citation deep-link flow:
 *
 *   1. GET /:meetingId/speaker-turns  → diarized transcript rows
 *   2. GET /:meetingId/playback-url   → presigned-GET URL for the meeting's
 *                                       latest completed recording
 *
 * Consent gate strategy:
 *   Both routes use `requireConsent: { meetingIdParam: 'meetingId' }` —
 *   the consent gate runs the existing `consentChecker(tenantId, meetingId)`
 *   directly off the URL param. No resolver registry needed; the meeting
 *   id is already in the route, so there's nothing to look up.
 *
 * Both routes are GETs and set `skipAudit: true` — they don't change
 * tenant-scoped state. The audit-coverage CI walker only enforces audit
 * coverage on state-changing methods, but `skipAudit` is set for
 * symmetry with the read-only `GET /api/v1/recordings/:id` route.
 */

import {
  type MeetingsListResponse,
  type RecordingPlaybackResponse,
  type SpeakerTurnsResponse,
  meetingsListResponseSchema,
  recordingPlaybackResponseSchema,
  speakerTurnsResponseSchema,
} from '@aisecretary/shared';
import type { StorageProvider } from '@aisecretary/storage';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../lib/http-error.js';
import type { MeetingsRepository } from './meetings-repository.js';

export interface MeetingsRoutesOptions {
  repository: MeetingsRepository;
  storage: StorageProvider;
  /** Override the presigned-GET expiry (tests). Defaults to 15 minutes. */
  playbackExpiresInSeconds?: number;
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

const meetingIdParamSchema = z.object({
  meetingId: z.string().uuid(),
});

const DEFAULT_PLAYBACK_EXPIRY_SECONDS = 15 * 60;

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
  cursor: z.string().min(1).optional(),
});

export const meetingsRoutes = (options: MeetingsRoutesOptions): FastifyPluginAsync => {
  const playbackExpiry = options.playbackExpiresInSeconds ?? DEFAULT_PLAYBACK_EXPIRY_SECONDS;

  return async (fastify) => {
    /**
     * GET / — list meetings for the current tenant (Story 1.7).
     *
     * Powers the inbox empty-state gate (`/inbox` renders
     * `<EmptyStateRecipient>` when `items.length === 0` on the first
     * page) and any future inbox surface that wants paginated access.
     *
     * No `requireConsent` gate — the user is reading their own tenant's
     * meeting list, not a specific meeting's recorded content. Per-
     * meeting playback / transcript routes carry their own consent
     * checks.
     */
    fastify.get<{
      Querystring: { limit?: string; cursor?: string };
    }>(
      '/',
      {
        config: { skipAudit: true },
      },
      async (request, reply) => {
        const { tenantId } = requireUser(request);
        const parsed = listQuerySchema.safeParse(request.query ?? {});
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid list-meetings query.',
          );
        }
        const { limit, cursor } = parsed.data;
        const result = await options.repository.listMeetings({
          tenantId,
          limit,
          cursor: cursor ?? null,
        });

        const body: MeetingsListResponse = {
          items: result.items.map((m) => ({
            id: m.id,
            title: m.title,
            source: m.source,
            status: m.status,
            durationSeconds: m.durationSeconds,
            startedAt: m.startedAt ? m.startedAt.toISOString() : null,
            endedAt: m.endedAt ? m.endedAt.toISOString() : null,
            createdAt: m.createdAt.toISOString(),
          })),
          nextCursor: result.nextCursor,
          totalCount: result.totalCount,
        };
        return reply.status(200).send(meetingsListResponseSchema.parse(body));
      },
    );

    fastify.get<{
      Params: { meetingId: string };
    }>(
      '/:meetingId/speaker-turns',
      {
        config: {
          requireConsent: { meetingIdParam: 'meetingId' },
          skipAudit: true,
        },
      },
      async (request, reply) => {
        const { tenantId } = requireUser(request);
        const parsed = meetingIdParamSchema.safeParse(request.params);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'meetingId must be a valid UUID',
          );
        }
        const { meetingId } = parsed.data;
        const rows = await options.repository.findSpeakerTurnsByMeetingId(meetingId, tenantId);

        const body: SpeakerTurnsResponse = {
          meetingId,
          turns: rows.map((r) => ({
            turnId: r.turnId,
            speaker: r.speaker,
            spanStartMs: r.spanStartMs,
            spanEndMs: r.spanEndMs,
            text: r.text,
            confidence: r.confidence,
            sequence: r.sequence,
          })),
        };
        return reply.status(200).send(speakerTurnsResponseSchema.parse(body));
      },
    );

    fastify.get<{
      Params: { meetingId: string };
    }>(
      '/:meetingId/playback-url',
      {
        config: {
          requireConsent: { meetingIdParam: 'meetingId' },
          skipAudit: true,
        },
      },
      async (request, reply) => {
        const { tenantId } = requireUser(request);
        const parsed = meetingIdParamSchema.safeParse(request.params);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'meetingId must be a valid UUID',
          );
        }
        const { meetingId } = parsed.data;

        const recording = await options.repository.findLatestCompletedRecordingByMeetingId(
          meetingId,
          tenantId,
        );
        if (!recording) {
          throw new NotFoundError(`No completed recording found for meeting ${meetingId}.`);
        }

        const presigned = await options.storage.presignGet(recording.storageKey, {
          expiresInSeconds: playbackExpiry,
        });

        const body: RecordingPlaybackResponse = {
          recordingId: recording.id,
          url: presigned.url,
          expiresAt: presigned.expiresAt.toISOString(),
          contentType: recording.contentType,
        };
        return reply.status(200).send(recordingPlaybackResponseSchema.parse(body));
      },
    );
  };
};
