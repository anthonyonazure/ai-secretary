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
 * `recordings` — one row per audio capture cycle (web/mobile/upload).
 *
 * Story 2.1 scope: tracks the multipart upload lifecycle (S3 upload id +
 * lifecycle status). Story 2.2 wires the real transcription engine into
 * the `transcribing → completed` transition; today the worker stub
 * marks `completed` after a no-op so the rest of the pipeline can be
 * exercised end-to-end.
 *
 * Tenant-scoped (RLS). RLS policies live in
 * `packages/db/rls/0005_rls_recordings.sql`.
 *
 * `meeting_id` is nullable because a recording row is created on
 * `POST /recordings/initiate` BEFORE the user has necessarily attached
 * the recording to a meeting (the in-place capture flow).
 */

export const recordingStatusEnum = pgEnum('recording_status', [
  'uploading',
  'uploaded',
  'transcribing',
  'completed',
  'failed',
]);

export const recordings = pgTable(
  'recordings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    meetingId: uuid('meeting_id').references(() => meetings.id, { onDelete: 'set null' }),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Provider-agnostic object key (resolves via packages/storage). */
    storageKey: text('storage_key').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    status: recordingStatusEnum('status').notNull().default('uploading'),
    /** S3 multipart upload id — null after `complete` or for non-multipart uploads. */
    s3UploadId: text('s3_upload_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    transcribedAt: timestamp('transcribed_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** Storage key uniqueness — same object cannot map to two recording rows. */
    uniqRecordingsStorageKey: uniqueIndex('uniq_recordings_storage_key').on(t.storageKey),
    idxRecordingsTenantCreated: index('idx_recordings_tenant_id_created_at').on(
      t.tenantId,
      t.createdAt,
    ),
    idxRecordingsMeeting: index('idx_recordings_meeting_id').on(t.meetingId),
  }),
);

export type Recording = typeof recordings.$inferSelect;
export type NewRecording = typeof recordings.$inferInsert;
