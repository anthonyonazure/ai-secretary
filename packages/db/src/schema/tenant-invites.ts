import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { userRoleEnum, users } from './users.js';

/**
 * `tenant_invites` — Story 1.5d.
 *
 * Captures pending email invitations for new org members. An admin
 * (`org_admin` / `super_admin`) creates a row with a one-shot token; the
 * recipient lands on `/accept-invite?token=…` and exchanges the token
 * for a session pair (the same shape `/auth/signup` returns). Tokens
 * are hashed at rest — only the plaintext form ever leaves the server,
 * inside the dispatched email.
 *
 * Tenant-scoped (RLS). Strict in-tenant policy + a separate "lookup by
 * token_hash" bypass policy for the unauthenticated accept-invite flow.
 * See `packages/db/rls/0009_rls_tenant_invites.sql`.
 *
 * Lifecycle / business rules:
 *   - One open invite per `(tenantId, email)`. Re-inviting an email that
 *     already has a pending row collides on the unique index — the API
 *     surfaces 409 (caller can revoke + recreate).
 *   - `expires_at` defaults to 7 days from creation; the API accepts an
 *     override up to 30 days.
 *   - `accepted_at` + `accepted_by_user_id` populate when the recipient
 *     completes the accept flow. The new user row is created in the
 *     same transaction (FK from `accepted_by_user_id` → `users.id`).
 *   - `revoked_at` + `revoked_by_user_id` populate when an admin
 *     cancels the invite. Once set, accept attempts return 410 Gone.
 *
 * Erasure cascade: `cascade` (FK ON DELETE CASCADE from `tenants`).
 */
export const tenantInvites = pgTable(
  'tenant_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** The org_admin (or super_admin) who created the invite. */
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Recipient email address (RFC 5321 normalized at the API edge). */
    email: text('email').notNull(),
    /** Role the recipient will hold once accepted. Never `super_admin`. */
    role: userRoleEnum('role').notNull().default('org_member'),
    /**
     * Single-use opaque token, hashed (sha256 hex) at rest.
     *
     * The plaintext form is 32 random bytes encoded as base64url (43
     * chars) and is dispatched only inside the recipient's email (and
     * the URL the email links to). It is NEVER persisted to this
     * column or written to logs.
     */
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedByUserId: uuid('revoked_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** One open invite per email per tenant. */
    uniqTenantInvitesTenantEmail: uniqueIndex('uniq_tenant_invites_tenant_id_email').on(
      t.tenantId,
      t.email,
    ),
    idxTenantInvitesTenantEmail: index('idx_tenant_invites_tenant_id_email').on(
      t.tenantId,
      t.email,
    ),
    idxTenantInvitesTokenHash: index('idx_tenant_invites_token_hash').on(t.tokenHash),
  }),
);

export type TenantInvite = typeof tenantInvites.$inferSelect;
export type NewTenantInvite = typeof tenantInvites.$inferInsert;
