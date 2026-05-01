import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * Story 8.4 / ADR-0006 — receiving-tenant inbound share record.
 *
 * One row per cross-org share landing in this tenant. Written by the
 * `share-service` cross-tenant write path; mirrors the audit_logs
 * append-only discipline. The unified admin audit timeline UNION-views
 * `audit_logs` with this table so org admins see incoming shares
 * alongside their own activity.
 *
 * `source_tenant_id` carries no FK — the sender may live in a different
 * region's database. `source_tenant_domain` + `source_user_email` are the
 * display labels.
 */

export const inboundShareKindEnum = pgEnum('inbound_share_kind', [
  'meeting',
  'clip',
  'insight',
  'token-url',
]);

export const inboundShareStatusEnum = pgEnum('inbound_share_status', [
  'pending',
  'accepted',
  'blocked-by-policy',
  'expired',
  'revoked',
]);

export const inboundShares = pgTable(
  'inbound_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Receiving tenant. */
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Sending tenant id — no FK because cross-region writes are
     *  permitted per ADR-0006 (source may live in another region's DB). */
    sourceTenantId: uuid('source_tenant_id').notNull(),
    /** Display label, e.g. `acme.com`. */
    sourceTenantDomain: text('source_tenant_domain').notNull(),
    sourceUserEmail: text('source_user_email').notNull(),
    /** Sender-side share row id — primary lookup key for revocation
     *  notifications. */
    sourceShareId: uuid('source_share_id').notNull(),
    kind: inboundShareKindEnum('kind').notNull(),
    recipientEmail: text('recipient_email').notNull(),
    /** Resolved on first acceptance if the recipient creates an account. */
    recipientUserId: uuid('recipient_user_id').references(() => users.id),
    resourceLabel: text('resource_label').notNull(),
    /** SHA-256 hex of the token URL when applicable. */
    tokenUrlHash: text('token_url_hash'),
    status: inboundShareStatusEnum('status').notNull().default('pending'),
    policyEvaluatedAt: timestamp('policy_evaluated_at', { withTimezone: true }),
    /** 'whitelist-match' | 'whitelist-miss' | 'block-all' | 'accept-all'
     *  | 'expired' | 'revoked'. */
    policyDecisionReason: text('policy_decision_reason'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxInboundSharesTenantStatus: index('idx_inbound_shares_tenant_status_created').on(
      t.tenantId,
      t.status,
      t.createdAt,
    ),
    idxInboundSharesTenantRecipient: index('idx_inbound_shares_tenant_recipient').on(
      t.tenantId,
      t.recipientEmail,
    ),
    idxInboundSharesTenantDomain: index('idx_inbound_shares_tenant_source_domain').on(
      t.tenantId,
      t.sourceTenantDomain,
    ),
    uqInboundSharesSource: uniqueIndex('uq_inbound_shares_source').on(t.tenantId, t.sourceShareId),
  }),
);

export type InboundShare = typeof inboundShares.$inferSelect;
export type NewInboundShare = typeof inboundShares.$inferInsert;
