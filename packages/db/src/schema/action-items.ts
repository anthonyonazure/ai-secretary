import { index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { meetings } from './meetings.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * `action_items` — Story 3.3 (extract-action-items worker handler).
 *
 * One row per explicit, agreed-upon commitment surfaced from a meeting
 * transcript. Lifecycle (FSM):
 *
 *   pending → accepted → done
 *           ↘ dismissed
 *
 * `owner_user_id` is nullable because the LLM emits a free-text
 * `ownerName` that may not match a tenant member; the worker resolves
 * to a user row when possible and leaves `owner_user_id` null otherwise.
 *
 * Tenant-scoped (RLS). Policies live in
 * `packages/db/rls/0012_rls_action_items.sql`. Strict in-tenant.
 *
 * Erasure cascade: `shred` (commitments quote transcript content + may
 * reference user names — PII).
 */

export const actionItemStatusEnum = pgEnum('action_item_status', [
  'pending',
  'accepted',
  'done',
  'dismissed',
]);

export const actionItems = pgTable(
  'action_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    /** Resolved tenant member when the LLM-emitted ownerName matched a user; null otherwise. */
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Free-text owner name from the transcript — preserved alongside the resolved FK. */
    ownerName: text('owner_name'),
    /** ISO-8601 due date — null when no date was discussed. */
    dueDate: timestamp('due_date', { withTimezone: true }),
    /** The action statement — imperative voice per the action-items module prompt. */
    text: text('text').notNull(),
    status: actionItemStatusEnum('status').notNull().default('pending'),
    /** 0.000–1.000 — same heuristic family as `module_outputs.confidence`. */
    confidence: numeric('confidence', { precision: 4, scale: 3 }),
    /**
     * Citations grounding the item in transcript spans. Same
     * `(meetingId, turnId)` contract as ModuleOutput bullets;
     * stored verbatim from `citationRefSchema`.
     */
    citations: jsonb('citations').$type<Array<Record<string, unknown>>>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxActionItemsTenantMeeting: index('idx_action_items_tenant_meeting').on(
      t.tenantId,
      t.meetingId,
    ),
    idxActionItemsOwner: index('idx_action_items_owner').on(t.tenantId, t.ownerUserId),
    idxActionItemsStatus: index('idx_action_items_status').on(t.tenantId, t.status),
  }),
);

export type ActionItem = typeof actionItems.$inferSelect;
export type NewActionItem = typeof actionItems.$inferInsert;
