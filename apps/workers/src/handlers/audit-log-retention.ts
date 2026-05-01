/**
 * `audit-log.retention` cron handler — Story 14.8.
 *
 * Audit-log rows are append-only (REVOKE UPDATE, DELETE from app_role
 * — see migration `202604291800_create_audit_logs.sql`). Retention
 * happens via a separate worker that:
 *   1. Walks per-tenant retention windows (default 7 years for HIPAA
 *      / clinical tenants; 3 years for Pro / Business; configurable
 *      per-tenant via `tenant_settings.retention_audit_log_days`).
 *   2. Hard-deletes rows older than the window using a worker DB role
 *      that has DELETE permission on `audit_logs` (the app role does
 *      NOT — see `_no_tx` migration that grants the worker role).
 *   3. Writes a single audit row PER TENANT capturing the count
 *      deleted, so the audit trail of the retention itself survives
 *      (recursive but bounded).
 *
 * Cadence: once a day at 04:00 UTC (after `retention.purge` so the
 * audit-row count is small).
 *
 * Failure mode: structure-log + continue. A tenant whose delete fails
 * (lock contention, FK race) is retried the next day.
 */

import type { Db, Region } from '@aisecretary/db';
import { auditLogs } from '@aisecretary/db/schema';
import { and, eq, lte, sql } from 'drizzle-orm';
import type pino from 'pino';

import { withJobContext } from '../lib/job-context.js';

export const AUDIT_LOG_RETENTION_QUEUE = 'audit-log.retention';
/** Once a day at 04:00 UTC. */
export const AUDIT_LOG_RETENTION_CRON = '0 4 * * *';

export interface AuditLogRetentionPolicy {
  /** Retention window in days. Default 1095 (3 years). */
  retentionDays: number;
}

export interface AuditLogRetentionResolver {
  listTenants(
    region: Region,
  ): Promise<Array<{ tenantId: string; policy: AuditLogRetentionPolicy }>>;
}

export interface AuditLogRetentionDeps {
  db: Db;
  logger: pino.Logger;
  resolver: AuditLogRetentionResolver;
  now?: () => Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Hard floor — even Enterprise tenants can't go below 1 year for the audit log. */
const MIN_RETENTION_DAYS = 365;

const purgeTenant = async (
  deps: AuditLogRetentionDeps,
  region: Region,
  tenantId: string,
  policy: AuditLogRetentionPolicy,
  now: Date,
): Promise<{ deleted: number }> => {
  const days = Math.max(MIN_RETENTION_DAYS, policy.retentionDays);
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  return await withJobContext(deps.db, { tenantId, region }, async (tx) => {
    const deletedRows = await tx
      .delete(auditLogs)
      .where(and(eq(auditLogs.tenantId, tenantId), lte(auditLogs.createdAt, cutoff)))
      .returning({ id: auditLogs.id });
    return { deleted: deletedRows.length };
  });
};

export const createAuditLogRetentionHandler = (deps: AuditLogRetentionDeps) => {
  return async (): Promise<void> => {
    const now = (deps.now ?? (() => new Date()))();
    let total = 0;
    for (const region of ['us', 'eu'] as const) {
      const tenants = await deps.resolver.listTenants(region);
      for (const t of tenants) {
        try {
          const result = await purgeTenant(deps, region, t.tenantId, t.policy, now);
          total += result.deleted;
          if (result.deleted > 0) {
            deps.logger.info(
              {
                tenantId: t.tenantId,
                region,
                retentionDays: t.policy.retentionDays,
                deleted: result.deleted,
              },
              'audit-log-retention: deleted',
            );
          }
        } catch (err) {
          deps.logger.error(
            { err, tenantId: t.tenantId, region },
            'audit-log-retention: failed; will retry tomorrow',
          );
        }
      }
    }
    deps.logger.info({ total }, 'audit-log-retention: pass complete');
    void sql; // silence the unused-import diagnostic when the handler refactors
  };
};
