import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * Story 15.x / ADR-0003 — `tenant_integrations`.
 *
 * Per-tenant CRM (and future) integration credentials. Each row is a
 * connected provider (HubSpot, Salesforce, Pipedrive) for one tenant.
 * OAuth tokens are stored in `encryptedToken` as JSONB envelope
 * ciphertext (see packages/db/src/lib/envelope-encryption.ts).
 *
 * Tenant-scoped (RLS). Workers read across tenants via BYPASSRLS for
 * the `crm.push` queue handler.
 */

export const integrationProviderEnum = pgEnum('integration_provider', [
  'hubspot',
  'salesforce',
  'pipedrive',
]);

export const integrationStatusEnum = pgEnum('integration_status', ['active', 'revoked', 'error']);

export interface EncryptedToken {
  /** Base64 ciphertext of the OAuth tokens JSON. */
  ciphertext: string;
  /** Base64 wrapped DEK (per-row data-encryption key). */
  dek: string;
  /** Base64 IV/nonce. */
  iv: string;
  /** Base64 GCM auth tag. */
  tag: string;
  /** Identifier of the at-rest KEK used to wrap `dek`. */
  kekId: string;
  /** Algorithm tag — currently always `aes-256-gcm`. */
  alg: 'aes-256-gcm';
  /** Envelope schema version. */
  version: 1;
}

export const tenantIntegrations = pgTable(
  'tenant_integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    provider: integrationProviderEnum('provider').notNull(),
    externalAccountId: text('external_account_id').notNull(),
    accountLabel: text('account_label').notNull(),
    instanceUrl: text('instance_url'),
    apiBaseUrl: text('api_base_url'),
    encryptedToken: jsonb('encrypted_token').$type<EncryptedToken>().notNull(),
    scopes: text('scopes').array().notNull().default(sql`ARRAY[]::TEXT[]`),
    status: integrationStatusEnum('status').notNull().default('active'),
    failureReason: text('failure_reason'),
    connectedByUserId: uuid('connected_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    lastTokenRefreshAt: timestamp('last_token_refresh_at', { withTimezone: true }),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** One active integration per (tenant, provider). Revoked rows are
     *  retained for audit but excluded from the partial unique index. */
    uniqActiveProvider: uniqueIndex('uniq_tenant_integrations_active')
      .on(t.tenantId, t.provider)
      .where(sql`status = 'active'`),
    idxTenantStatus: index('idx_tenant_integrations_tenant_status').on(t.tenantId, t.status),
    idxTokenExpires: index('idx_tenant_integrations_token_expires_at').on(t.tokenExpiresAt),
  }),
);

export type TenantIntegrationRow = typeof tenantIntegrations.$inferSelect;
export type NewTenantIntegrationRow = typeof tenantIntegrations.$inferInsert;
