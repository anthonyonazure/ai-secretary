import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'org_admin',
  'org_member',
  'org_viewer',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    /** Argon2id hash via @node-rs/argon2. Null for SSO-only accounts. */
    passwordHash: text('password_hash'),
    role: userRoleEnum('role').notNull().default('org_member'),
    name: text('name').notNull().default(''),
    isMfaEnabled: boolean('is_mfa_enabled').notNull().default(false),
    /** Encrypted TOTP secret — decrypt key from KMS / MFA_SECRET_ENCRYPTION_KEY. */
    mfaSecretEncrypted: text('mfa_secret_encrypted'),
    /**
     * Story 1.5c — true between `/auth/mfa/enroll` and `/auth/mfa/confirm`.
     * Resets to false (and `is_mfa_enabled=true`) on confirm.
     * If a user abandons the flow, a subsequent enroll overwrites the
     * pending secret without requiring a manual reset.
     */
    mfaPending: boolean('mfa_pending').notNull().default(false),
    /**
     * Story 1.5c — sha256 hashes of recovery codes (single-use). Codes
     * are presented to the user once at enrollment / regenerate;
     * `consumeRecoveryCode` removes a hash from this array on use.
     */
    recoveryCodeHashes: text('recovery_code_hashes').array().notNull().default([]),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxUsersTenantEmail: index('idx_users_tenant_id_email').on(t.tenantId, t.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
