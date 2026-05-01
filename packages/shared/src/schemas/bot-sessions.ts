import { z } from 'zod';

/**
 * Wire contract for the bot-sessions API surface (Story 9.x).
 *
 * apps/api implements:
 *   - POST /api/v1/bot-sessions    (create + enqueue join job)
 *   - GET  /api/v1/bot-sessions/:sessionId   (status read — chunk 4)
 *   - GET  /api/v1/bot-sessions               (list — chunk 4)
 *
 * apps/web + apps/mobile consume them through `lib/bot-sessions/*`
 * once the producer is real.
 */

export const botSourceSchema = z.enum(['zoom_bot', 'teams_bot']);
export type BotSourceWire = z.infer<typeof botSourceSchema>;

export const botSessionStatusSchema = z.enum(['provisioning', 'joined', 'ended', 'failed']);
export type BotSessionStatusWire = z.infer<typeof botSessionStatusSchema>;

export const createBotSessionRequestSchema = z.object({
  /** Provider platform — drives provider selection + audit copy. */
  source: botSourceSchema,
  /**
   * Provider-native meeting handle. Zoom: meeting number. Teams: online-
   * meeting ID or join URL. Opaque to the platform; the bot service
   * passes it to the provider unchanged.
   */
  externalMeetingId: z.string().min(1).max(2048),
  /**
   * Optional pre-shared passcode. Stored write-only — never returned in
   * any read response. Zoom requires it for password-gated meetings.
   */
  externalMeetingPasscode: z.string().min(1).max(256).optional(),
  /**
   * Optional meeting binding. When provided, the bot session is
   * associated with the existing meeting row from the start. Otherwise
   * the bot service may attach to a meeting created later.
   */
  meetingId: z.string().uuid().optional(),
});
export type CreateBotSessionRequest = z.infer<typeof createBotSessionRequestSchema>;

export const botSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  meetingId: z.string().uuid().nullable(),
  source: botSourceSchema,
  status: botSessionStatusSchema,
  region: z.enum(['us', 'eu']),
  externalMeetingId: z.string(),
  joinedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type BotSessionResponse = z.infer<typeof botSessionResponseSchema>;
