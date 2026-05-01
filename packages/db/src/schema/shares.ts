import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { meetings } from './meetings.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * Story 8.1 — sender-side share grant model.
 *
 * `shares` represents the source-of-truth on the SENDING tenant. Each row
 * is a single grant (owner/editor/viewer for in-tenant; viewer-implicit
 * for token URLs). Cross-org sharing produces a corresponding row in the
 * RECEIVING tenant's `inbound_shares` table per ADR-0006 — written via
 * the dedicated `share-service` cross-tenant write path.
 *
 * Token discipline: plaintext token only ever exists in the URL handed to
 * the recipient. Stored as `token_hash` (SHA-256 hex). Lookups hash + compare.
 */

export const shareKindEnum = pgEnum('share_kind', ['meeting', 'clip', 'insight', 'token-url']);

export const shareScopeEnum = pgEnum('share_scope', ['owner', 'editor', 'viewer']);

export const shares = pgTable(
  'shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    kind: shareKindEnum('kind').notNull(),
    /** `owner` / `editor` / `viewer` for in-tenant grants. Token URLs
     *  default to `viewer`. */
    scope: shareScopeEnum('scope').notNull().default('viewer'),
    /** For in-tenant grants — recipient by email (resolved to userId on
     *  first view). For token-URL kinds, optional — the URL is the
     *  primary handle. */
    recipientEmail: text('recipient_email'),
    /** Resolved on first view of an in-tenant grant; nullable. */
    recipientUserId: uuid('recipient_user_id').references(() => users.id),
    /** SHA-256 hex of the plaintext token URL — only present for
     *  `kind = 'token-url'`. The plaintext NEVER lives in the DB. */
    tokenHash: text('token_hash'),
    /** Default 30 days from creation per UX spec § "share expiry". */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedByUserId: uuid('revoked_by_user_id').references(() => users.id),
    /** For `kind = 'clip'`: bounded span in ms relative to recording start. */
    clipStartMs: bigint('clip_start_ms', { mode: 'number' }),
    clipEndMs: bigint('clip_end_ms', { mode: 'number' }),
    /** For `kind = 'insight'`: which module output is exposed (e.g.
     *  'general' / 'sales'). The receiver sees ONLY this slice. */
    insightModuleId: text('insight_module_id'),
    /** Cross-org flag — flipped when `recipient_email`'s domain belongs
     *  to another tenant. Drives the receiving-tenant `inbound_shares`
     *  write. Story 8.4 hardens the detection; Story 8.1 ships the column. */
    crossOrg: text('cross_org', { enum: ['true', 'false'] })
      .notNull()
      .default('false'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxSharesTenantMeeting: index('idx_shares_tenant_meeting').on(t.tenantId, t.meetingId),
    idxSharesTenantRecipient: index('idx_shares_tenant_recipient').on(t.tenantId, t.recipientEmail),
    uqSharesTokenHash: uniqueIndex('uq_shares_token_hash').on(t.tokenHash),
  }),
);

export type Share = typeof shares.$inferSelect;
export type NewShare = typeof shares.$inferInsert;
