import { z } from 'zod';

/**
 * Wire contract for the meetings API surface (Story 2.1 follow-up).
 *
 * apps/api implements:
 *   - GET /api/v1/meetings/:meetingId/speaker-turns
 *   - GET /api/v1/meetings/:meetingId/playback-url
 *
 * The web + mobile `useSpeakerTurns` hook consumes the speaker-turns
 * endpoint; `usePlaybackUrl` resolves the meeting → recording → presigned
 * GET URL chain via the playback-url endpoint, keeping `recordingId`
 * server-side (the citation surface only carries `meetingId`).
 *
 * `turnId` is the stable hash from `packages/db/src/schema/speaker-turns.ts`
 * (`turn_id` column) — NOT the row UUID. The deep-link contract is
 * `(meetingId, turnId)` per Story 2.4 + Story 3.5.
 */

export const speakerTurnSchema = z.object({
  turnId: z.string(),
  speaker: z.string().nullable(),
  spanStartMs: z.number().int().nonnegative(),
  spanEndMs: z.number().int().nonnegative(),
  text: z.string(),
  /** 0..1 confidence; null while streaming. */
  confidence: z.number().min(0).max(1).nullable(),
  sequence: z.number().int().nonnegative(),
});
export type SpeakerTurn = z.infer<typeof speakerTurnSchema>;

export const speakerTurnsResponseSchema = z.object({
  meetingId: z.string().uuid(),
  turns: z.array(speakerTurnSchema),
});
export type SpeakerTurnsResponse = z.infer<typeof speakerTurnsResponseSchema>;

/**
 * GET /api/v1/meetings — list summary contract (Story 1.7).
 *
 * The inbox surface (and the F2 first-launch flow's empty-state gate)
 * consume this. Cursor-based pagination per CLAUDE.md (no offset).
 * `nextCursor` is a base64 token; clients pass it back as `?cursor=`.
 */
export const meetingSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  source: z.enum(['mobile_recording', 'web_recording', 'upload', 'zoom_bot', 'teams_bot']),
  status: z.enum([
    'pending_upload',
    'uploaded',
    'transcribing',
    'transcribed',
    'summarizing',
    'summarized',
    'analyzing',
    'analyzed',
    'failed',
  ]),
  durationSeconds: z.number().int().nullable(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type MeetingSummary = z.infer<typeof meetingSummarySchema>;

export const meetingsListResponseSchema = z.object({
  items: z.array(meetingSummarySchema),
  nextCursor: z.string().nullable(),
  totalCount: z.number().int().nonnegative(),
});
export type MeetingsListResponse = z.infer<typeof meetingsListResponseSchema>;
