/**
 * Upload-retry-exhausted wire schema — Story 4.5 (FR68).
 *
 * Client-side resumable upload retries silently for 10 minutes on a
 * transient network failure. At budget exhaustion the client posts to
 * `/api/v1/recordings/:id/upload-escalation` so the server can emit
 * the user-facing notification + the audit row.
 */

import { z } from 'zod';

export const uploadEscalationRequestSchema = z.object({
  /** Last successful chunk index — null when zero chunks landed. */
  lastChunkIndex: z.number().int().min(0).nullable(),
  /** Total bytes uploaded so far (resumable upload's accumulated state). */
  bytesUploaded: z.number().int().min(0),
  /** Free-form reason from the client — surfaced in the audit row. */
  reason: z.string().max(500),
  /** Network condition at the time of escalation (best-effort hint). */
  networkClass: z.enum(['offline', 'slow', 'unknown']).default('unknown'),
});
export type UploadEscalationRequest = z.infer<typeof uploadEscalationRequestSchema>;

export const uploadEscalationResponseSchema = z.object({
  recordingId: z.string().uuid(),
  acknowledged: z.literal(true),
  /** Suggested next-step copy — drives the in-app banner CTA. */
  message: z.string(),
});
export type UploadEscalationResponse = z.infer<typeof uploadEscalationResponseSchema>;
