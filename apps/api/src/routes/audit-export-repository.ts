/**
 * Repository seam for the audit-log export route (Story 14.5).
 *
 * Tenant scoping is enforced at the RLS layer; the repository sets
 * `app.current_tenant_id` via `withTenantContext` before issuing the
 * SELECT so any cross-tenant rows fail to appear.
 *
 * The query is bounded by `limit` (capped server-side at 10,000) and
 * the `since` / `until` window to keep response sizes finite. CSV
 * generation lives in the route layer — the repository returns
 * normalized row shapes only.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { auditLogs } from '@aisecretary/db/schema';
import { type SQL, and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';

export interface AuditExportRowInternal {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  requestId: string | null;
  region: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditExportListInput {
  tenantId: string;
  since: Date;
  until: Date;
  actions?: string[];
  resourceType?: string;
  limit: number;
}

export interface AuditExportResult {
  items: AuditExportRowInternal[];
  totalCount: number;
}

export interface AuditExportRepository {
  list(input: AuditExportListInput): Promise<AuditExportResult>;
}

export class DrizzleAuditExportRepository implements AuditExportRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async list(input: AuditExportListInput): Promise<AuditExportResult> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const conditions: SQL[] = [
          eq(auditLogs.tenantId, input.tenantId),
          gte(auditLogs.createdAt, input.since),
          lt(auditLogs.createdAt, input.until),
        ];
        if (input.actions && input.actions.length > 0) {
          conditions.push(inArray(auditLogs.action, input.actions));
        }
        if (input.resourceType) {
          conditions.push(eq(auditLogs.resourceType, input.resourceType));
        }
        const where = and(...conditions);

        const rows = await tx
          .select({
            id: auditLogs.id,
            tenantId: auditLogs.tenantId,
            actorUserId: auditLogs.actorUserId,
            action: auditLogs.action,
            resourceType: auditLogs.resourceType,
            resourceId: auditLogs.resourceId,
            metadata: auditLogs.metadata,
            requestId: auditLogs.requestId,
            region: auditLogs.region,
            ipAddress: auditLogs.ipAddress,
            userAgent: auditLogs.userAgent,
            createdAt: auditLogs.createdAt,
          })
          .from(auditLogs)
          .where(where)
          .orderBy(desc(auditLogs.createdAt))
          .limit(input.limit);

        const totalRows = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(auditLogs)
          .where(where);
        const totalCount = Number(totalRows[0]?.count ?? 0);

        return {
          items: rows.map((r) => ({
            id: r.id,
            tenantId: r.tenantId,
            actorUserId: r.actorUserId,
            action: r.action,
            resourceType: r.resourceType,
            resourceId: r.resourceId,
            metadata: (r.metadata ?? {}) as Record<string, unknown>,
            requestId: r.requestId,
            region: r.region,
            ipAddress: r.ipAddress === null ? null : String(r.ipAddress),
            userAgent: r.userAgent,
            createdAt: r.createdAt,
          })),
          totalCount,
        };
      },
    );
  }
}

export class InMemoryAuditExportRepository implements AuditExportRepository {
  public readonly rows: AuditExportRowInternal[] = [];

  async list(input: AuditExportListInput): Promise<AuditExportResult> {
    const all = this.rows.filter((r) => {
      if (r.tenantId !== input.tenantId) return false;
      const t = r.createdAt.getTime();
      if (t < input.since.getTime()) return false;
      if (t >= input.until.getTime()) return false;
      if (input.actions && input.actions.length > 0 && !input.actions.includes(r.action)) {
        return false;
      }
      if (input.resourceType && r.resourceType !== input.resourceType) return false;
      return true;
    });
    const sorted = [...all].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      items: sorted.slice(0, input.limit),
      totalCount: sorted.length,
    };
  }
}
