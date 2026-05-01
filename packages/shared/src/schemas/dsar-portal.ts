/**
 * Public DSAR portal — Story 14.3 (FR52).
 *
 * Wire schemas for the auth-free portal at `aisecretary.app/data-rights`.
 * Non-customer third parties submit access / deletion / correction
 * requests; submissions land on a per-tenant queue once identity is
 * verified via the email-link flow.
 *
 * Two-step flow:
 *   1. POST `/api/v1/data-rights/submissions` — submitter fills the
 *      form and we email them a verification link
 *   2. GET  `/api/v1/data-rights/submissions/:token/verify` — clicking
 *      the link flips the row to `verified` and routes it to the
 *      receiving tenant's admin queue
 *
 * The portal is intentionally plain-language (GOV.UK register per UX
 * spec § Step 11). No marketing copy, no upsell, no AI Secretary
 * branding beyond the wordmark.
 */

import { z } from 'zod';

export const dsarPortalRequestKindSchema = z.enum(['access', 'deletion', 'correction']);
export type DsarPortalRequestKind = z.infer<typeof dsarPortalRequestKindSchema>;

export const dsarPortalSubmitRequestSchema = z.object({
  /** What the submitter is asking for. */
  kind: dsarPortalRequestKindSchema,
  /** Submitter's email — must be verifiable. */
  email: z.string().email().max(254),
  /** Display name — used in the verification email + in the
   *  receiving tenant's queue UI. */
  fullName: z.string().min(1).max(200),
  /** The tenant the submitter believes holds their data. */
  tenantSlug: z.string().min(1).max(120),
  /** Free-form description of the data + the request. Capped to
   *  prevent abuse via long payloads. */
  description: z.string().min(10).max(4000),
  /** Optional secondary verification — phone or alternate email. */
  secondaryVerification: z.string().max(200).optional(),
});
export type DsarPortalSubmitRequest = z.infer<typeof dsarPortalSubmitRequestSchema>;

export const dsarPortalSubmissionStatusSchema = z.enum([
  'pending-verification',
  'verified',
  'expired',
  'rejected',
]);
export type DsarPortalSubmissionStatus = z.infer<typeof dsarPortalSubmissionStatusSchema>;

export const dsarPortalSubmissionResponseSchema = z.object({
  id: z.string().uuid(),
  status: dsarPortalSubmissionStatusSchema,
  /** ISO 8601 — when the verification link expires (default 7 days). */
  verificationExpiresAt: z.string().datetime(),
  /** Plain-language confirmation message to render. */
  message: z.string(),
});
export type DsarPortalSubmissionResponse = z.infer<typeof dsarPortalSubmissionResponseSchema>;

export const dsarPortalVerifyResponseSchema = z.object({
  status: dsarPortalSubmissionStatusSchema,
  message: z.string(),
});
export type DsarPortalVerifyResponse = z.infer<typeof dsarPortalVerifyResponseSchema>;
