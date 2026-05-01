/**
 * Repository seam for the erasure-cascade preview route (Story 14.4).
 *
 * Mirrors the worker-side `erasure-runner` but in COUNT-ONLY mode —
 * each table-counter returns the number of rows the corresponding
 * destructive action *would* touch, without mutating anything. The
 * API surfaces this for an admin confirmation step before queueing
 * the actual erasure job.
 *
 * Tenant scoping is enforced via RLS in `withTenantContext` so a
 * cross-tenant scope yields zero counts.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import {
  actionItems,
  auditLogs,
  feedbackThumbs,
  meetings,
  notifications,
  users,
} from '@aisecretary/db/schema';
import { type SQL, and, eq, sql } from 'drizzle-orm';

export type PreviewAction =
  | 'shred'
  | 'redact'
  | 'soft-delete'
  | 'cascade-fk'
  | 'cascade-source-skipped'
  | 'noop-out-of-scope';

export interface PreviewStage {
  table: string;
  strategy: 'cascade-source' | 'cascade' | 'soft-delete' | 'shred' | 'redact';
  action: PreviewAction;
  rowCount: number;
  note?: string;
}

export interface ErasurePreviewInput {
  tenantId: string;
  userId: string;
}

export interface ErasurePreviewResult {
  scope: ErasurePreviewInput;
  stages: PreviewStage[];
  totalRowsAffected: number;
  fullyHandled: boolean;
}

/**
 * The cascade walk for the preview happens at the registry level — the
 * caller passes the canonical erasure-cascade entry shape so the route
 * is independent of the API's internal registry layout.
 */
export interface CascadeEntryInput {
  table: string;
  strategy: PreviewStage['strategy'];
}

export interface ErasurePreviewRepository {
  preview(
    cascade: readonly CascadeEntryInput[],
    input: ErasurePreviewInput,
  ): Promise<ErasurePreviewResult>;
}

/** Drizzle implementation — issues `count(*)` per relevant table. */
export class DrizzleErasurePreviewRepository implements ErasurePreviewRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async preview(
    cascade: readonly CascadeEntryInput[],
    input: ErasurePreviewInput,
  ): Promise<ErasurePreviewResult> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const stages: PreviewStage[] = [];
        let fullyHandled = true;
        let totalRowsAffected = 0;

        const countOne = async (where: SQL): Promise<number> => {
          const rows = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(meetings)
            .where(where);
          return Number(rows[0]?.count ?? 0);
        };
        // Per-table count queries inlined below — Drizzle's chained
        // API is awkward to unify behind a generic so the inline form
        // keeps the types correct without casting.
        const counters: Record<string, () => Promise<PreviewStage>> = {
          tenants: async () => ({
            table: 'tenants',
            strategy: 'cascade-source',
            action: 'cascade-source-skipped',
            rowCount: 0,
            note: 'cascade-source rows are reserved for tenant-level erasure',
          }),
          users: async () => {
            const rows = await tx
              .select({ count: sql<number>`count(*)::int` })
              .from(users)
              .where(and(eq(users.tenantId, input.tenantId), eq(users.id, input.userId)));
            return {
              table: 'users',
              strategy: 'cascade',
              action: 'shred',
              rowCount: Number(rows[0]?.count ?? 0),
              note: 'User row deleted last; FK CASCADE removes consents + tenant_invites + auth_identities.',
            };
          },
          meetings: async () => ({
            table: 'meetings',
            strategy: 'shred',
            action: 'shred',
            rowCount: await countOne(
              and(
                eq(meetings.tenantId, input.tenantId),
                eq(meetings.ownerUserId, input.userId),
              ) as SQL,
            ),
            note: 'Includes recordings + speaker_turns + module_outputs + action_items via FK cascade.',
          }),
          action_items: async () => {
            const rows = await tx
              .select({ count: sql<number>`count(*)::int` })
              .from(actionItems)
              .where(
                and(
                  eq(actionItems.tenantId, input.tenantId),
                  eq(actionItems.ownerUserId, input.userId),
                ),
              );
            return {
              table: 'action_items',
              strategy: 'shred',
              action: 'redact',
              rowCount: Number(rows[0]?.count ?? 0),
              note: 'NULL owner_user_id + owner_name on items NOT covered by meetings cascade.',
            };
          },
          notifications: async () => {
            const rows = await tx
              .select({ count: sql<number>`count(*)::int` })
              .from(notifications)
              .where(
                and(
                  eq(notifications.tenantId, input.tenantId),
                  eq(notifications.recipient, input.userId),
                ),
              );
            return {
              table: 'notifications',
              strategy: 'redact',
              action: 'redact',
              rowCount: Number(rows[0]?.count ?? 0),
              note: 'Replace recipient with [redacted] (push notifications keyed on userId).',
            };
          },
          audit_logs: async () => {
            const rows = await tx
              .select({ count: sql<number>`count(*)::int` })
              .from(auditLogs)
              .where(
                and(
                  eq(auditLogs.tenantId, input.tenantId),
                  eq(auditLogs.actorUserId, input.userId),
                ),
              );
            return {
              table: 'audit_logs',
              strategy: 'redact',
              action: 'redact',
              rowCount: Number(rows[0]?.count ?? 0),
              note: 'NULL actor_user_id + ip_address + user_agent; preserve action+resource trail.',
            };
          },
          feedback_thumbs: async () => {
            const rows = await tx
              .select({ count: sql<number>`count(*)::int` })
              .from(feedbackThumbs)
              .where(
                and(
                  eq(feedbackThumbs.tenantId, input.tenantId),
                  eq(feedbackThumbs.userId, input.userId),
                ),
              );
            return {
              table: 'feedback_thumbs',
              strategy: 'cascade',
              action: 'shred',
              rowCount: Number(rows[0]?.count ?? 0),
              note: 'Hard delete via FK CASCADE when users row goes.',
            };
          },
          // Out-of-scope tables — present so the preview shows the
          // explicit "intentionally untouched" line for admin clarity.
          user_preferences: async () => ({
            table: 'user_preferences',
            strategy: 'cascade',
            action: 'noop-out-of-scope',
            rowCount: 0,
            note: 'Cascades from tenants; user-scope preference rows go via FK cascade.',
          }),
          tenant_invites: async () => ({
            table: 'tenant_invites',
            strategy: 'cascade',
            action: 'noop-out-of-scope',
            rowCount: 0,
            note: 'Cascades from tenants; tenant-scoped, not user-scoped.',
          }),
          shares: async () => ({
            table: 'shares',
            strategy: 'cascade',
            action: 'noop-out-of-scope',
            rowCount: 0,
            note: 'Sender-side share grants; tenant policy handles separately.',
          }),
          inbound_shares: async () => ({
            table: 'inbound_shares',
            strategy: 'redact',
            action: 'noop-out-of-scope',
            rowCount: 0,
            note: 'Receiving-tenant audit trail; preserved.',
          }),
          dsar_requests: async () => ({
            table: 'dsar_requests',
            strategy: 'redact',
            action: 'noop-out-of-scope',
            rowCount: 0,
            note: 'Preserved as legal trail; the request row stays.',
          }),
          module_outputs: async () => ({
            table: 'module_outputs',
            strategy: 'shred',
            action: 'cascade-fk',
            rowCount: 0,
            note: 'Covered by FK CASCADE from meetings.',
          }),
          speaker_turns: async () => ({
            table: 'speaker_turns',
            strategy: 'shred',
            action: 'cascade-fk',
            rowCount: 0,
            note: 'Covered by FK CASCADE from meetings.',
          }),
          recordings: async () => ({
            table: 'recordings',
            strategy: 'shred',
            action: 'cascade-fk',
            rowCount: 0,
            note: 'Covered by FK CASCADE from meetings.',
          }),
          consents: async () => ({
            table: 'consents',
            strategy: 'redact',
            action: 'cascade-fk',
            rowCount: 0,
            note: 'Covered by FK CASCADE from users.',
          }),
        };

        for (const entry of cascade) {
          const counter = counters[entry.table];
          if (!counter) {
            fullyHandled = false;
            stages.push({
              table: entry.table,
              strategy: entry.strategy,
              action: 'noop-out-of-scope',
              rowCount: 0,
              note: 'no counter registered for table',
            });
            continue;
          }
          const stage = await counter();
          stages.push(stage);
          if (stage.action !== 'noop-out-of-scope') {
            totalRowsAffected += stage.rowCount;
          }
        }

        return {
          scope: input,
          stages,
          totalRowsAffected,
          fullyHandled,
        };
      },
    );
  }
}

/** In-memory variant for tests. */
export class InMemoryErasurePreviewRepository implements ErasurePreviewRepository {
  /** Configurable per-table count map; default zero. */
  public readonly counts: Record<string, number> = {};

  async preview(
    cascade: readonly CascadeEntryInput[],
    input: ErasurePreviewInput,
  ): Promise<ErasurePreviewResult> {
    const stages: PreviewStage[] = cascade.map((entry) => {
      const rowCount = this.counts[entry.table] ?? 0;
      const action = mapActionFromStrategy(entry.table, entry.strategy);
      return {
        table: entry.table,
        strategy: entry.strategy,
        action,
        rowCount: action === 'noop-out-of-scope' ? 0 : rowCount,
      };
    });
    const totalRowsAffected = stages.reduce(
      (acc, s) => (s.action !== 'noop-out-of-scope' ? acc + s.rowCount : acc),
      0,
    );
    return {
      scope: input,
      stages,
      totalRowsAffected,
      fullyHandled: true,
    };
  }
}

const SHRED_TABLES = new Set(['users', 'meetings', 'feedback_thumbs']);
const REDACT_TABLES = new Set(['action_items', 'notifications', 'audit_logs']);
const CASCADE_FK_TABLES = new Set(['module_outputs', 'speaker_turns', 'recordings', 'consents']);

const mapActionFromStrategy = (
  table: string,
  strategy: PreviewStage['strategy'],
): PreviewAction => {
  if (strategy === 'cascade-source') return 'cascade-source-skipped';
  if (SHRED_TABLES.has(table)) return 'shred';
  if (REDACT_TABLES.has(table)) return 'redact';
  if (CASCADE_FK_TABLES.has(table)) return 'cascade-fk';
  return 'noop-out-of-scope';
};
