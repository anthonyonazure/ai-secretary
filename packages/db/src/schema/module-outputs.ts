import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { meetings } from './meetings.js';
import { tenants } from './tenants.js';

/**
 * `module_outputs` — Story 3.2 (summarize worker handler).
 *
 * One row per `(meeting, module)` pair. The `output` jsonb column holds
 * the discriminated `ModuleOutput` JSON validated by the shared
 * `moduleOutputSchema` at write time inside the worker. The unique
 * `(meeting_id, module_id)` constraint lets re-runs UPSERT — the
 * AnalysisCard renderer always sees the latest analysis.
 *
 * `confidence` drives the AnalysisCard low-confidence chip. The MVP
 * heuristic in the worker (Story 3.2) maps `finishReason='stop'` plus a
 * mild input-size bonus to a score in [0, 1]; Story 3.6 will replace
 * this with a citation-required CI gate.
 *
 * Tenant-scoped (RLS). Policies live in
 * `packages/db/rls/0011_rls_module_outputs.sql`. Strict in-tenant.
 *
 * Erasure cascade: `shred` (analysis content references PII per the
 * citation deep-links it carries).
 */
export const moduleOutputs = pgTable(
  'module_outputs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    /**
     * Module discriminator — matches `ModuleId` from
     * `@aisecretary/shared` ('general' | 'sales' | 'hr' | etc.). Stored
     * as text rather than enum so adding a vertical in Story 5.x doesn't
     * require a migration.
     */
    moduleId: text('module_id').notNull(),
    /**
     * The discriminated `ModuleOutput` JSON. Schema enforced at the
     * worker level (parsed against `moduleOutputSchema` before insert).
     */
    output: jsonb('output').$type<Record<string, unknown>>().notNull(),
    /** 0.000–1.000 — derived from LLM finish reason + heuristic. */
    confidence: numeric('confidence', { precision: 4, scale: 3 }),
    /** Provider kind that generated this output — for ops triage + cost analysis. */
    providerKind: text('provider_kind'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    /** When the analysis was last refreshed. Re-runs UPSERT. */
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** Re-runs replace via UPSERT keyed on this pair. */
    uqModuleOutputsMeetingModule: uniqueIndex('uq_module_outputs_meeting_id_module_id').on(
      t.meetingId,
      t.moduleId,
    ),
    idxModuleOutputsTenantMeeting: index('idx_module_outputs_tenant_meeting').on(
      t.tenantId,
      t.meetingId,
    ),
  }),
);

export type ModuleOutputRow = typeof moduleOutputs.$inferSelect;
export type NewModuleOutputRow = typeof moduleOutputs.$inferInsert;
