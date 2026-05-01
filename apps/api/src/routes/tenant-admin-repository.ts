/**
 * Repository seam for the F2-admin endpoints (Story 12.1).
 *
 * Reads the tenant row + applies state-FSM transitions (DPA accept,
 * region-pin one-shot). All writes go through `withTenantContext` so
 * RLS scopes the operation to the caller's tenant.
 */

import { type Db, type Region, withTenantContext } from '@aisecretary/db';
import { tenants } from '@aisecretary/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

export type TenantStateLifecycle =
  | 'draft'
  | 'dpa_required'
  | 'dpa_accepted'
  | 'region_pinning'
  | 'provisioning'
  | 'active'
  | 'suspended';

export interface TenantStateRow {
  id: string;
  state: TenantStateLifecycle;
  region: Region;
  dpaVersion: string | null;
  dpaAcceptedAt: Date | null;
  regionLockedAt: Date | null;
}

export class RegionAlreadyPinnedError extends Error {
  constructor(region: Region, lockedAt: Date) {
    super(`region already pinned to '${region}' at ${lockedAt.toISOString()}`);
    this.name = 'RegionAlreadyPinnedError';
  }
}

export interface TenantAdminRepository {
  findState(tenantId: string): Promise<TenantStateRow | null>;
  acceptDpa(input: {
    tenantId: string;
    userId: string;
    dpaVersion: string;
  }): Promise<TenantStateRow>;
  pinRegion(input: {
    tenantId: string;
    region: Region;
  }): Promise<TenantStateRow>;
}

export class DrizzleTenantAdminRepository implements TenantAdminRepository {
  constructor(
    private readonly db: Db,
    private readonly region: Region,
  ) {}

  async findState(tenantId: string): Promise<TenantStateRow | null> {
    return await withTenantContext(this.db, { tenantId, region: this.region }, async (tx) => {
      const rows = await tx
        .select({
          id: tenants.id,
          state: tenants.state,
          region: tenants.region,
          dpaVersion: tenants.dpaVersion,
          dpaAcceptedAt: tenants.dpaAcceptedAt,
          regionLockedAt: tenants.regionLockedAt,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        state: row.state as TenantStateLifecycle,
        region: row.region,
        dpaVersion: row.dpaVersion,
        dpaAcceptedAt: row.dpaAcceptedAt,
        regionLockedAt: row.regionLockedAt,
      };
    });
  }

  async acceptDpa(input: {
    tenantId: string;
    userId: string;
    dpaVersion: string;
  }): Promise<TenantStateRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const updated = await tx
          .update(tenants)
          .set({
            state: 'dpa_accepted',
            dpaVersion: input.dpaVersion,
            dpaAcceptedAt: new Date(),
            dpaAcceptedByUserId: input.userId,
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, input.tenantId))
          .returning({
            id: tenants.id,
            state: tenants.state,
            region: tenants.region,
            dpaVersion: tenants.dpaVersion,
            dpaAcceptedAt: tenants.dpaAcceptedAt,
            regionLockedAt: tenants.regionLockedAt,
          });
        const row = updated[0];
        if (!row) throw new Error('acceptDpa: tenant not found');
        return {
          id: row.id,
          state: row.state as TenantStateLifecycle,
          region: row.region,
          dpaVersion: row.dpaVersion,
          dpaAcceptedAt: row.dpaAcceptedAt,
          regionLockedAt: row.regionLockedAt,
        };
      },
    );
  }

  async pinRegion(input: {
    tenantId: string;
    region: Region;
  }): Promise<TenantStateRow> {
    return await withTenantContext(
      this.db,
      { tenantId: input.tenantId, region: this.region },
      async (tx) => {
        const updated = await tx
          .update(tenants)
          .set({
            region: input.region,
            regionLockedAt: new Date(),
            // Region-pin transitions the FSM forward to provisioning.
            state: 'provisioning',
            updatedAt: new Date(),
          })
          // Guard at write time: only succeed if regionLockedAt is null.
          // The DB trigger `enforce_region_lock` is the second line of
          // defense — this WHERE clause is the first.
          .where(and(eq(tenants.id, input.tenantId), isNull(tenants.regionLockedAt)))
          .returning({
            id: tenants.id,
            state: tenants.state,
            region: tenants.region,
            dpaVersion: tenants.dpaVersion,
            dpaAcceptedAt: tenants.dpaAcceptedAt,
            regionLockedAt: tenants.regionLockedAt,
          });
        const row = updated[0];
        if (!row) {
          // Either the tenant doesn't exist OR region is already
          // pinned. Re-read to disambiguate.
          const existing = await tx
            .select({
              id: tenants.id,
              region: tenants.region,
              regionLockedAt: tenants.regionLockedAt,
            })
            .from(tenants)
            .where(eq(tenants.id, input.tenantId))
            .limit(1);
          const found = existing[0];
          if (found?.regionLockedAt) {
            throw new RegionAlreadyPinnedError(found.region, found.regionLockedAt);
          }
          throw new Error('pinRegion: tenant not found');
        }
        return {
          id: row.id,
          state: row.state as TenantStateLifecycle,
          region: row.region,
          dpaVersion: row.dpaVersion,
          dpaAcceptedAt: row.dpaAcceptedAt,
          regionLockedAt: row.regionLockedAt,
        };
      },
    );
  }
}

export class InMemoryTenantAdminRepository implements TenantAdminRepository {
  public readonly rows = new Map<string, TenantStateRow>();

  seed(row: TenantStateRow): void {
    this.rows.set(row.id, row);
  }

  async findState(tenantId: string): Promise<TenantStateRow | null> {
    return this.rows.get(tenantId) ?? null;
  }

  async acceptDpa(input: {
    tenantId: string;
    userId: string;
    dpaVersion: string;
  }): Promise<TenantStateRow> {
    const existing = this.rows.get(input.tenantId);
    if (!existing) throw new Error('acceptDpa: tenant not found');
    void input.userId;
    const updated: TenantStateRow = {
      ...existing,
      state: 'dpa_accepted',
      dpaVersion: input.dpaVersion,
      dpaAcceptedAt: new Date(),
    };
    this.rows.set(input.tenantId, updated);
    return updated;
  }

  async pinRegion(input: { tenantId: string; region: Region }): Promise<TenantStateRow> {
    const existing = this.rows.get(input.tenantId);
    if (!existing) throw new Error('pinRegion: tenant not found');
    if (existing.regionLockedAt) {
      throw new RegionAlreadyPinnedError(existing.region, existing.regionLockedAt);
    }
    const updated: TenantStateRow = {
      ...existing,
      region: input.region,
      regionLockedAt: new Date(),
      state: 'provisioning',
    };
    this.rows.set(input.tenantId, updated);
    return updated;
  }
}
