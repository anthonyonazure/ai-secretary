import { sql } from 'drizzle-orm';
import { index, inet, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * `audit_logs` — append-only ledger of every state-changing operation.
 *
 * Append-only enforcement lives at the SQL level (REVOKE UPDATE, DELETE
 * from `app_role` — see migration `202604291800_create_audit_logs.sql`).
 * The `audit-logger` plugin in `apps/api` is the only sanctioned writer.
 *
 * Tenant-scoped (RLS). Cross-tenant audit writes are NOT supported —
 * cross-org sharing instead writes to the receiver's `inbound_shares`
 * table per `arch-addendums.md` § 8 / ADR-0006.
 */

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Null for system-initiated actions (workers, schedulers). */
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /**
     * Canonical action string from `apps/api/src/lib/audit-types.ts`.
     * The plugin rejects unknown actions before insert, so this is
     * effectively a closed enum at the application layer.
     */
    action: text('action').notNull(),
    /** Resource type (`meeting`, `tenant`, `user`, ...). */
    resourceType: text('resource_type').notNull(),
    /** Optional opaque resource identifier (UUID/string). */
    resourceId: text('resource_id'),
    /** Free-form structured context. PII redacted on DSAR — see erasure-cascade. */
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    requestId: text('request_id').notNull(),
    /** 'us' | 'eu' — captured for cross-region audit reads. */
    region: text('region').notNull(),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    idxAuditLogsTenantCreated: index('idx_audit_logs_tenant_id_created_at').on(
      t.tenantId,
      t.createdAt,
    ),
    idxAuditLogsTenantAction: index('idx_audit_logs_tenant_id_action').on(t.tenantId, t.action),
    idxAuditLogsTenantResource: index('idx_audit_logs_tenant_id_resource').on(
      t.tenantId,
      t.resourceType,
      t.resourceId,
    ),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
