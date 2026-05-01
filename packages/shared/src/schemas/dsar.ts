/**
 * Wire contract for the self-service DSAR API surface (Story 14.1).
 *
 * Routes:
 *   POST   /api/v1/dsar/requests        → create or return active request
 *   GET    /api/v1/dsar/requests        → list authed user's DSAR history
 *   GET    /api/v1/dsar/requests/:id    → single request status
 *
 * The POST handler is idempotent: if a request in `queued` or
 * `processing` state already exists for the user, the existing row is
 * returned (200) instead of creating a new one (202).
 */

import { z } from 'zod';

export const dsarRequestStatusSchema = z.enum([
  'queued',
  'processing',
  'ready',
  'failed',
  'expired',
]);
export type DsarRequestStatus = z.infer<typeof dsarRequestStatusSchema>;

/**
 * 202-style POST response — minimal handshake. The client polls the
 * GET endpoint or waits for the `dsar-ready` email to follow up.
 */
export const createDsarRequestResponseSchema = z.object({
  requestId: z.string().uuid(),
  status: dsarRequestStatusSchema,
  /** ISO 8601 — `now() + 24h`. Not a hard SLA at the API layer. */
  estimatedReadyAt: z.string().datetime(),
});
export type CreateDsarRequestResponse = z.infer<typeof createDsarRequestResponseSchema>;

/**
 * Single DSAR request — same shape returned by GET list + GET single.
 * `downloadUrl` only populates when `status='ready'`.
 */
export const dsarRequestSchema = z.object({
  id: z.string().uuid(),
  status: dsarRequestStatusSchema,
  downloadUrl: z.string().url().nullable(),
  downloadExpiresAt: z.string().datetime().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  readyAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
});
export type DsarRequestWire = z.infer<typeof dsarRequestSchema>;

export const dsarRequestsListResponseSchema = z.object({
  items: z.array(dsarRequestSchema),
});
export type DsarRequestsListResponse = z.infer<typeof dsarRequestsListResponseSchema>;
