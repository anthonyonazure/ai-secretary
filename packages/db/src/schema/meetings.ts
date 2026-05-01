import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const meetingSourceEnum = pgEnum('meeting_source', [
  'mobile_recording',
  'web_recording',
  'upload',
  'zoom_bot',
  'teams_bot',
]);

export const meetingStatusEnum = pgEnum('meeting_status', [
  'pending_upload',
  'uploaded',
  'transcribing',
  'transcribed',
  'summarizing',
  'summarized',
  'analyzing',
  'analyzed',
  'failed',
]);

export const meetings = pgTable(
  'meetings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: text('title').notNull().default(''),
    source: meetingSourceEnum('source').notNull(),
    status: meetingStatusEnum('status').notNull().default('pending_upload'),
    durationSeconds: integer('duration_seconds'),
    /** Storage object key (provider-agnostic); resolves via packages/storage. */
    audioObjectKey: text('audio_object_key'),
    /** External ref for Zoom/Teams bot meetings. */
    externalMeetingId: text('external_meeting_id'),
    /** Module entitlement(s) used for this meeting's analysis. */
    appliedModules: jsonb('applied_modules').$type<string[]>().default([]),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxMeetingsTenantCreated: index('idx_meetings_tenant_id_created_at').on(
      t.tenantId,
      t.createdAt,
    ),
    idxMeetingsOwnerCreated: index('idx_meetings_owner_user_id_created_at').on(
      t.ownerUserId,
      t.createdAt,
    ),
  }),
);

export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
