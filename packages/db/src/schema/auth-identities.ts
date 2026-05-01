import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Story 1.5b — external identity links.
 *
 * One row per `(provider, provider_user_id)` pair. Lets a single user row
 * sign in via email/password OR Google OR Microsoft (or any combination)
 * by mapping the provider's stable user id back to `users.id`.
 *
 * `provider_user_id` discipline:
 *   - Google: the `sub` claim from the verified ID token (stable across
 *     email + display-name changes).
 *   - Microsoft: the `oid` claim (stable per-tenant + cross-tenant) —
 *     prefer over `sub` because `sub` rotates per app registration.
 *
 * No tenant_id column — identities belong to the user, who carries the
 * tenant. RLS is enforced through the `users.tenant_id` join.
 */

export const oauthProviderEnum = pgEnum('oauth_provider', ['google', 'microsoft']);

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: oauthProviderEnum('provider').notNull(),
    /** Stable provider user id (sub / oid). */
    providerUserId: text('provider_user_id').notNull(),
    /** Stash the provider-reported email for audit trail. NULL when the
     *  provider hides email (rare). Not used for lookup — that's
     *  user_id's job. */
    providerEmail: text('provider_email'),
    /** Last sign-in timestamp via this identity. */
    lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqAuthIdentitiesProvider: uniqueIndex('uq_auth_identities_provider').on(
      t.provider,
      t.providerUserId,
    ),
    idxAuthIdentitiesUser: index('idx_auth_identities_user').on(t.userId),
  }),
);

export type AuthIdentity = typeof authIdentities.$inferSelect;
export type NewAuthIdentity = typeof authIdentities.$inferInsert;
