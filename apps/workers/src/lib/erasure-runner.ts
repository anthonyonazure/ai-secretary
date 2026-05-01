/**
 * Erasure-cascade runner — Story 14.2 (right-to-erasure ≤30d).
 *
 * Walks the erasure-cascade registry (`apps/api/src/lib/erasure-cascade.ts`)
 * for a `(tenantId, userId)` scope and applies each table's strategy:
 *
 *   - `cascade-source`  → no-op for user-level erasure (only tenant-level
 *                         erasure ever touches the cascade root).
 *   - `cascade`         → no-op; the FK ON DELETE CASCADE handles cleanup
 *                         when the user row goes (registered in the
 *                         users-row executor).
 *   - `shred`           → call the registered per-table executor that
 *                         hard-deletes user-owned rows + scrubs any
 *                         out-of-band PII (object storage keys, vector
 *                         embeddings).
 *   - `redact`          → call the registered per-table executor that
 *                         replaces PII columns with NULL placeholders.
 *   - `soft-delete`     → not currently used by any registered table.
 *
 * The runner is a pure orchestrator — it accepts a `TableExecutorRegistry`
 * which maps table → executor. Tables in the cascade registry that have
 * NO matching executor in the runner registry get a `'unhandled'` entry
 * in the report; the caller decides whether that's an error (production)
 * or a warning (during incremental rollout).
 *
 * Shape of the report drives the audit emit — one `dsar.erasure-stage`
 * audit per (table, action) line. The 30d SLA is enforced upstream by
 * the queue scheduler (the request row carries an `expiresAt`); this
 * runner is the thing that has to actually finish before that deadline.
 */

import type { ErasureCascadeEntry, ErasureStrategy } from './erasure-types.js';

export interface ErasureScope {
  tenantId: string;
  userId: string;
}

export interface ErasureExecutorContext extends ErasureScope {
  /** Free-form host context — DB tx, storage provider, logger, etc. */
  host: unknown;
}

/**
 * One per-table executor. Implementations live in the worker handler
 * and close over `tx` + storage. Returns the number of rows touched
 * for the audit row + an action label so the report carries the
 * specific verb (`'shred'` vs `'redact'` vs `'noop-cascade-fk'`).
 */
export type TableExecutor = (ctx: ErasureExecutorContext) => Promise<TableExecutorResult>;

export interface TableExecutorResult {
  /** Rows touched by this executor. */
  rowsAffected: number;
  /** Verb used for the audit emit. */
  action:
    | 'shred'
    | 'redact'
    | 'soft-delete'
    | 'cascade-fk'
    | 'cascade-source-skipped'
    | 'noop-out-of-scope';
  /** Optional free-form note for the audit metadata bag. */
  note?: string;
}

export interface TableExecutorRegistry {
  /** key = snake_case table name. */
  [table: string]: TableExecutor;
}

export interface ErasureRunReport {
  scope: ErasureScope;
  stages: ErasureStageReport[];
  /** True when every registered table had a matching executor. */
  fullyHandled: boolean;
}

export interface ErasureStageReport {
  table: string;
  strategy: ErasureStrategy;
  result:
    | { kind: 'ran'; rowsAffected: number; action: TableExecutorResult['action']; note?: string }
    | { kind: 'unhandled'; reason: string };
}

/**
 * Default no-op executors for strategies that don't need user-scoped
 * action. The cascade-source root (`tenants`) is never deleted by a
 * user-erasure — the row stays, only user-tied data goes. Tables
 * marked `cascade` are covered by the FK ON DELETE CASCADE that fires
 * when the `users` row itself is deleted; their executors should be
 * `noopCascadeFk` UNLESS the FK targets the tenant rather than the
 * user (in which case a user-erasure does NOT cascade and the
 * executor must do work).
 */
export const cascadeSourceSkippedExecutor: TableExecutor = async () => ({
  rowsAffected: 0,
  action: 'cascade-source-skipped',
  note: 'cascade-source rows are reserved for tenant-level erasure',
});

export const noopCascadeFkExecutor: TableExecutor = async () => ({
  rowsAffected: 0,
  action: 'cascade-fk',
  note: 'covered by FK ON DELETE CASCADE from users row',
});

export const noopOutOfScopeExecutor: TableExecutor = async () => ({
  rowsAffected: 0,
  action: 'noop-out-of-scope',
  note: 'table has no user-scoped data; no action needed for user-erasure',
});

/**
 * Run the erasure cascade for one user. Walks the registry in declared
 * order so audit emits land in a stable sequence; relies on the caller
 * to wrap individual stages in any tx semantics they need (each
 * executor is free to open its own tx so a partial-failure mid-run
 * leaves the database in a known state).
 */
export const runErasureCascade = async (
  cascade: readonly ErasureCascadeEntry[],
  registry: TableExecutorRegistry,
  scope: ErasureScope,
  host: unknown,
): Promise<ErasureRunReport> => {
  const stages: ErasureStageReport[] = [];
  let fullyHandled = true;
  for (const entry of cascade) {
    const executor = registry[entry.table];
    if (!executor) {
      fullyHandled = false;
      stages.push({
        table: entry.table,
        strategy: entry.strategy,
        result: { kind: 'unhandled', reason: 'no executor registered for table' },
      });
      continue;
    }
    const result = await executor({ ...scope, host });
    stages.push({
      table: entry.table,
      strategy: entry.strategy,
      result: {
        kind: 'ran',
        rowsAffected: result.rowsAffected,
        action: result.action,
        ...(result.note !== undefined ? { note: result.note } : {}),
      },
    });
  }
  return { scope, stages, fullyHandled };
};
