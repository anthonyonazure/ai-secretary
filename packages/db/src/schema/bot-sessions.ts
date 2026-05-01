import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { meetings } from './meetings.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * Story 9.x — bot session FSM.
 *
 * Producer-side persistence for the meeting-bot subsystem. The
 * `apps/workers/src/handlers/bot-watchdog.ts` handler scans this table
 * every 15s for in-flight rows (status ∈ provisioning|joined AND
 * created_at within 24h) and enqueues `bot-join-failed` notifications
 * when their heartbeat key is missing from Redis.
 *
 * FSM transitions (mirrored in `packages/bot/src/fsm.ts`):
 *   provisioning → joined        (provider join() resolved)
 *   provisioning → failed        (join refused / cred error)
 *   joined        → ended        (provider leave() resolved)
 *   joined        → failed       (connection lost / abort)
 */

export const botSourceEnum = pgEnum('bot_source', ['zoom_bot', 'teams_bot']);

export const botSessionStatusEnum = pgEnum('bot_session_status', [
  'provisioning',
  'joined',
  'ended',
  'failed',
]);

export const botRegionEnum = pgEnum('bot_region', ['us', 'eu']);

export const botSessions = pgTable(
  'bot_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Nullable on creation — meeting row may not exist yet. */
    meetingId: uuid('meeting_id').references(() => meetings.id, { onDelete: 'set null' }),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id),
    source: botSourceEnum('source').notNull(),
    status: botSessionStatusEnum('status').notNull().default('provisioning'),
    region: botRegionEnum('region').notNull(),
    /** Provider-native meeting handle. Opaque. */
    externalMeetingId: text('external_meeting_id').notNull(),
    /** Optional pre-shared passcode (Zoom). NEVER returned in API responses. */
    externalMeetingPasscode: text('external_meeting_passcode'),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    /** Populated only on transitions into `failed`. */
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxBotSessionsTenantStatusCreated: index('idx_bot_sessions_tenant_status_created').on(
      t.tenantId,
      t.status,
      t.createdAt,
    ),
    idxBotSessionsTenantMeeting: index('idx_bot_sessions_tenant_meeting').on(
      t.tenantId,
      t.meetingId,
    ),
    idxBotSessionsTenantOwnerCreated: index('idx_bot_sessions_tenant_owner_created').on(
      t.tenantId,
      t.ownerUserId,
      t.createdAt,
    ),
  }),
);

export type BotSessionRow = typeof botSessions.$inferSelect;
export type NewBotSessionRow = typeof botSessions.$inferInsert;
