import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { meetings } from './meetings.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * `feedback_thumbs` — Story 1.7.
 *
 * Captures the per-meeting thumbs-up / thumbs-down receipt prompt that
 * the first-three-receipt polish surface raises (UX spec § F2 user
 * first-launch flow). One row per (user, meeting); the UNIQUE
 * constraint enforces the "one response per user per meeting" rule.
 *
 * Tenant-scoped (RLS). Policies live in
 * `packages/db/rls/0007_rls_feedback_thumbs.sql`.
 *
 * Erasure cascade: `cascade` (FK ON DELETE CASCADE from `tenants`).
 */
export const feedbackThumbs = pgTable(
  'feedback_thumbs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    /** 'up' | 'down'. CHECK constraint enforced in the SQL migration. */
    response: text('response').notNull(),
    /** Free-form context tag — e.g. 'first-three' | 'general'. */
    context: text('context'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** One response per user per meeting. */
    uniqFeedbackThumbsUserMeeting: uniqueIndex('uniq_feedback_thumbs_user_id_meeting_id').on(
      t.userId,
      t.meetingId,
    ),
    idxFeedbackThumbsTenantCreated: index('idx_feedback_thumbs_tenant_id_created_at').on(
      t.tenantId,
      t.createdAt,
    ),
  }),
);

export type FeedbackThumb = typeof feedbackThumbs.$inferSelect;
export type NewFeedbackThumb = typeof feedbackThumbs.$inferInsert;
