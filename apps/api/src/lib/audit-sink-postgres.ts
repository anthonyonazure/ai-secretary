/**
 * Postgres-backed `AuditSink`.
 *
 * Wraps the Drizzle insert with `withTenantContext(tenantId, region, fn)`
 * so the row's `tenant_id` is RLS-checked at insert time. Cross-tenant
 * audit writes are NOT supported per `arch-addendums.md` § 8 — the
 * reverse-shape (writes against the receiver's `inbound_shares`) is the
 * sanctioned cross-org path.
 *
 * Production sink: wired by `buildServer()` when `dbHandle` is provided.
 * Tests use the in-memory sink instead (or override directly).
 */

import { type Db, withTenantContext } from '@aisecretary/db';
import { auditLogs } from '@aisecretary/db/schema';
import type { AuditRecord, AuditSink } from '../plugins/audit-logger.js';

export class PostgresAuditSink implements AuditSink {
  constructor(private readonly db: Db) {}

  async write(record: AuditRecord): Promise<void> {
    await withTenantContext(
      this.db,
      {
        tenantId: record.tenantId,
        region: record.region,
        userId: record.actorUserId ?? null,
      },
      async (tx) => {
        await tx.insert(auditLogs).values({
          tenantId: record.tenantId,
          actorUserId: record.actorUserId,
          action: record.action,
          resourceType: record.resourceType,
          resourceId: record.resourceId,
          metadata: record.metadata,
          requestId: record.requestId,
          region: record.region,
          ipAddress: record.ipAddress,
          userAgent: record.userAgent,
        });
      },
    );
  }
}
