/**
 * Repository seam for the DSAR routes + worker (Story 14.1).
 *
 * Production wires Drizzle against `dsar_requests` (RLS strict
 * in-tenant). Tests inject `InMemoryDsarRepository`. Mirrors the
 * invites + feedback repositories — the route layer never imports
 * Drizzle directly.
 *
 * The repository is also consumed by the worker handler
 * (`apps/workers/src/handlers/dsar-export.ts`) to flip lifecycle state:
 * queued → processing → ready / failed.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { dsarRequests } from '@aisecretary/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';

export type DsarRequestStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'expired';

export interface DsarRequestRow {
  id: string;
  tenantId: string;
  userId: string;
  status: DsarRequestStatus;
  downloadUrl: string | null;
  downloadExpiresAt: Date | null;
  storageKey: string | null;
  sizeBytes: number | null;
  failureReason: string | null;
  createdAt: Date;
  readyAt: Date | null;
  expiresAt: Date | null;
}

export interface CreateDsarRequestInput {
  tenantId: string;
  userId: string;
  expiresAt: Date;
}

export interface MarkReadyInput {
  storageKey: string;
  downloadUrl: string;
  downloadExpiresAt: Date;
  sizeBytes: number;
}

export interface DsarRepository {
  /** Insert a new `queued` request row. */
  create(input: CreateDsarRequestInput): Promise<DsarRequestRow>;
  /** List the authed user's DSAR history, newest first. */
  findByUser(tenantId: string, userId: string): Promise<DsarRequestRow[]>;
  /** Single fetch by id; returns null cross-tenant or unknown. */
  findById(tenantId: string, id: string): Promise<DsarRequestRow | null>;
  /**
   * Find the user's currently-active request (status in queued |
   * processing). Used by the API for idempotent POST.
   */
  findActiveForUser(tenantId: string, userId: string): Promise<DsarRequestRow | null>;
  /** Worker FSM: queued → processing. */
  markProcessing(id: string): Promise<void>;
  /** Worker FSM: processing → ready (writes presigned URL + size). */
  markReady(id: string, input: MarkReadyInput): Promise<void>;
  /** Worker FSM: any → failed. Truncates `reason` to 500 chars. */
  markFailed(id: string, reason: string): Promise<void>;
}

const ACTIVE_STATUSES: DsarRequestStatus[] = ['queued', 'processing'];
const FAILURE_REASON_MAX = 500;

const mapRow = (row: typeof dsarRequests.$inferSelect): DsarRequestRow => ({
  id: row.id,
  tenantId: row.tenantId,
  userId: row.userId,
  status: row.status as DsarRequestStatus,
  downloadUrl: row.downloadUrl ?? null,
  downloadExpiresAt: row.downloadExpiresAt ?? null,
  storageKey: row.storageKey ?? null,
  sizeBytes: row.sizeBytes ?? null,
  failureReason: row.failureReason ?? null,
  createdAt: row.createdAt,
  readyAt: row.readyAt ?? null,
  expiresAt: row.expiresAt ?? null,
});

export class DrizzleDsarRepository implements DsarRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async create(input: CreateDsarRequestInput): Promise<DsarRequestRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const rows = await tx
          .insert(dsarRequests)
          .values({
            tenantId: input.tenantId,
            userId: input.userId,
            status: 'queued',
            expiresAt: input.expiresAt,
          })
          .returning();
        const row = rows[0];
        if (!row) {
          throw new Error('createDsarRequest: insert returned no rows');
        }
        return mapRow(row);
      },
    );
  }

  async findByUser(tenantId: string, userId: string): Promise<DsarRequestRow[]> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select()
        .from(dsarRequests)
        .where(and(eq(dsarRequests.tenantId, tenantId), eq(dsarRequests.userId, userId)))
        .orderBy(desc(dsarRequests.createdAt));
      return rows.map(mapRow);
    });
  }

  async findById(tenantId: string, id: string): Promise<DsarRequestRow | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select()
        .from(dsarRequests)
        .where(and(eq(dsarRequests.id, id), eq(dsarRequests.tenantId, tenantId)))
        .limit(1);
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  async findActiveForUser(tenantId: string, userId: string): Promise<DsarRequestRow | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select()
        .from(dsarRequests)
        .where(
          and(
            eq(dsarRequests.tenantId, tenantId),
            eq(dsarRequests.userId, userId),
            inArray(dsarRequests.status, ACTIVE_STATUSES),
          ),
        )
        .orderBy(desc(dsarRequests.createdAt))
        .limit(1);
      return rows[0] ? mapRow(rows[0]) : null;
    });
  }

  /**
   * Worker-side state mutation. The worker's `withJobContext` already
   * sets the tenant GUC, so RLS clears via the strict in-tenant policy
   * even though the method itself doesn't pass tenantId.
   */
  async markProcessing(id: string): Promise<void> {
    await this.db.update(dsarRequests).set({ status: 'processing' }).where(eq(dsarRequests.id, id));
  }

  async markReady(id: string, input: MarkReadyInput): Promise<void> {
    await this.db
      .update(dsarRequests)
      .set({
        status: 'ready',
        storageKey: input.storageKey,
        downloadUrl: input.downloadUrl,
        downloadExpiresAt: input.downloadExpiresAt,
        sizeBytes: input.sizeBytes,
        readyAt: new Date(),
      })
      .where(eq(dsarRequests.id, id));
  }

  async markFailed(id: string, reason: string): Promise<void> {
    await this.db
      .update(dsarRequests)
      .set({
        status: 'failed',
        failureReason: reason.slice(0, FAILURE_REASON_MAX),
      })
      .where(eq(dsarRequests.id, id));
  }
}

/**
 * In-memory DSAR repository for tests. Mirrors the Drizzle behaviour
 * including the active-status lookup contract.
 */
export class InMemoryDsarRepository implements DsarRepository {
  public readonly rows: DsarRequestRow[] = [];

  async create(input: CreateDsarRequestInput): Promise<DsarRequestRow> {
    const row: DsarRequestRow = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      userId: input.userId,
      status: 'queued',
      downloadUrl: null,
      downloadExpiresAt: null,
      storageKey: null,
      sizeBytes: null,
      failureReason: null,
      createdAt: new Date(),
      readyAt: null,
      expiresAt: input.expiresAt,
    };
    this.rows.push(row);
    return row;
  }

  async findByUser(tenantId: string, userId: string): Promise<DsarRequestRow[]> {
    return this.rows
      .filter((r) => r.tenantId === tenantId && r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findById(tenantId: string, id: string): Promise<DsarRequestRow | null> {
    return this.rows.find((r) => r.id === id && r.tenantId === tenantId) ?? null;
  }

  async findActiveForUser(tenantId: string, userId: string): Promise<DsarRequestRow | null> {
    const matches = this.rows
      .filter(
        (r) => r.tenantId === tenantId && r.userId === userId && ACTIVE_STATUSES.includes(r.status),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return matches[0] ?? null;
  }

  private replace(id: string, mut: (row: DsarRequestRow) => DsarRequestRow): void {
    const idx = this.rows.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const existing = this.rows[idx];
    if (!existing) return;
    this.rows[idx] = mut(existing);
  }

  async markProcessing(id: string): Promise<void> {
    this.replace(id, (r) => ({ ...r, status: 'processing' }));
  }

  async markReady(id: string, input: MarkReadyInput): Promise<void> {
    this.replace(id, (r) => ({
      ...r,
      status: 'ready',
      storageKey: input.storageKey,
      downloadUrl: input.downloadUrl,
      downloadExpiresAt: input.downloadExpiresAt,
      sizeBytes: input.sizeBytes,
      readyAt: new Date(),
    }));
  }

  async markFailed(id: string, reason: string): Promise<void> {
    this.replace(id, (r) => ({
      ...r,
      status: 'failed',
      failureReason: reason.slice(0, FAILURE_REASON_MAX),
    }));
  }
}
