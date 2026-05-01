import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * `notifications` — append-only log of dispatched (or suppressed)
 * notifications. Owned by `packages/notifications`. Schema per
 * `_bmad-output/planning-artifacts/arch-addendums.md` § 5.
 *
 * Tenant-scoped (RLS). Recipient is stored as an opaque string —
 * `userId` for push, normalized email address for email — to keep
 * dedup lookups O(1) by index.
 */

export const notificationChannelEnum = pgEnum('notification_channel', ['push', 'email']);

export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',
  'sent',
  'failed',
  'suppressed',
]);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Push: userId. Email: normalized lowercase address. */
    recipient: text('recipient').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    /** Product-level event kind; matches NotificationKind union in the package. */
    kind: text('kind').notNull(),
    /** sha256 hex of the rendered payload — useful for postmortems. */
    payloadHash: text('payload_hash').notNull(),
    status: notificationStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    /** Caller-supplied or derived dedup discriminator. Indexed. */
    dedupKey: text('dedup_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** Hot lookup for the dedup window. */
    idxNotificationsDedup: index('idx_notifications_dedup').on(
      t.tenantId,
      t.recipient,
      t.kind,
      t.dedupKey,
      t.createdAt,
    ),
    idxNotificationsTenantCreated: index('idx_notifications_tenant_id_created_at').on(
      t.tenantId,
      t.createdAt,
    ),
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

/**
 * `user_preferences` — per-user, per-channel + per-kind opt-out table.
 * Story 1.10 AC: "per-channel + per-kind opt-out respected via
 * `user_preferences` table". A row's presence + `optedOut: true`
 * indicates suppression; absence = default-on.
 *
 * Tenant-scoped. (userId, channel, kind) is unique per tenant.
 */
export const userPreferences = pgTable(
  'user_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    /** NotificationKind value; not enum'd at the DB layer to keep new kinds cheap. */
    kind: text('kind').notNull(),
    optedOut: text('opted_out').notNull().default('true'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxUserPreferencesUnique: uniqueIndex('idx_user_preferences_user_channel_kind').on(
      t.tenantId,
      t.userId,
      t.channel,
      t.kind,
    ),
  }),
);

export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
