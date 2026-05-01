/**
 * Wire contract for the tenant-invite API surface (Story 1.5d).
 *
 * Two flows share these schemas:
 *
 *   Admin flow (authenticated, scoped to tenant):
 *     POST   /api/v1/tenants/:tenantId/invites
 *     GET    /api/v1/tenants/:tenantId/invites
 *     DELETE /api/v1/tenants/:tenantId/invites/:id
 *
 *   Public accept flow (unauthenticated, token in URL):
 *     GET    /api/v1/invites/:token         (lookup metadata)
 *     POST   /api/v1/invites/:token/accept  (consume + create user)
 *
 * The accept-invite *response* is the same shape `/auth/signup` returns
 * (`authResponseSchema` from `./auth.ts`) — a session pair + user. The
 * recipient is logged in immediately on a successful accept.
 *
 * Token discipline:
 *   The `token` URL segment + `acceptInviteRequestSchema.token` are the
 *   plaintext form (32 random bytes, base64url; 43 chars). The DB stores
 *   sha256(plaintext) — the plaintext only ever exists in the dispatched
 *   email and the URL the recipient lands on.
 */

import { z } from 'zod';
import { regionSchema, userRoleSchema } from './auth.js';

void regionSchema;

/**
 * Roles an admin may grant via invite. Excludes `super_admin` — that's
 * a platform-level role granted out-of-band, never via tenant invite.
 */
export const inviteRoleSchema = userRoleSchema.exclude(['super_admin']);
export type InviteRole = z.infer<typeof inviteRoleSchema>;

export const createInviteRequestSchema = z.object({
  email: z.string().email().max(254),
  role: inviteRoleSchema,
  /** Days until expiry; default 7, max 30. */
  ttlDays: z.number().int().min(1).max(30).optional(),
});
export type CreateInviteRequest = z.infer<typeof createInviteRequestSchema>;

export const inviteSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: userRoleSchema,
  invitedBy: z.object({
    userId: z.string().uuid(),
    name: z.string(),
  }),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type Invite = z.infer<typeof inviteSchema>;

export const invitesListResponseSchema = z.object({
  items: z.array(inviteSchema),
  totalCount: z.number().int().nonnegative(),
});
export type InvitesListResponse = z.infer<typeof invitesListResponseSchema>;

export const inviteLookupResponseSchema = z.object({
  /**
   * Public-facing invite metadata. Deliberately omits `tenantId` — the
   * recipient sees an opaque tenant *name*, not the routing id.
   */
  email: z.string().email(),
  tenantName: z.string(),
  inviterName: z.string(),
  role: userRoleSchema,
  expiresAt: z.string().datetime(),
});
export type InviteLookupResponse = z.infer<typeof inviteLookupResponseSchema>;

export const acceptInviteRequestSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128),
  name: z.string().min(1).max(120),
});
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;

// Accept-invite returns the same shape as signup — re-export
// `authResponseSchema` as the response type from `./auth.ts`.
