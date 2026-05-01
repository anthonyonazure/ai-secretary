import type { Db } from '@aisecretary/db';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import {
  type AuditLogRetentionResolver,
  createAuditLogRetentionHandler,
} from './audit-log-retention.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface FakeAuditRow {
  id: string;
  tenantId: string;
  createdAt: Date;
}

const buildFakeDb = (rows: FakeAuditRow[]) => {
  const remaining = [...rows];
  let activeTenant: string | null = null;
  let activeCutoff: Date | null = null;
  const txStub = {
    execute: vi.fn(async () => undefined),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => {
          if (!activeTenant || !activeCutoff) return [];
          const cutoff = activeCutoff.getTime();
          const keep: FakeAuditRow[] = [];
          const deleted: FakeAuditRow[] = [];
          for (const r of remaining) {
            if (r.tenantId === activeTenant && r.createdAt.getTime() <= cutoff) deleted.push(r);
            else keep.push(r);
          }
          remaining.length = 0;
          remaining.push(...keep);
          return deleted.map((r) => ({ id: r.id }));
        }),
      })),
    })),
  };
  const db = {
    select: vi.fn(),
    transaction: vi.fn(async (cb: (tx: typeof txStub) => Promise<unknown>) => {
      // Tests set up activeTenant / activeCutoff before calling.
      return cb(txStub);
    }),
    __getRows: () => remaining,
    __setActive: (tenantId: string, cutoff: Date) => {
      activeTenant = tenantId;
      activeCutoff = cutoff;
    },
  } as unknown as Db & {
    __getRows: () => FakeAuditRow[];
    __setActive: (tenantId: string, cutoff: Date) => void;
  };
  return db;
};

describe('audit-log-retention', () => {
  it('purges rows older than the retention window', async () => {
    const tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const now = new Date('2026-04-30T04:00:00Z');
    const db = buildFakeDb([
      { id: 'a1', tenantId: tenant, createdAt: new Date(now.getTime() - 5 * 365 * ONE_DAY_MS) },
      { id: 'a2', tenantId: tenant, createdAt: new Date(now.getTime() - 30 * ONE_DAY_MS) },
    ]);
    const resolver: AuditLogRetentionResolver = {
      listTenants: async (region) =>
        region === 'us' ? [{ tenantId: tenant, policy: { retentionDays: 1095 } }] : [],
    };
    db.__setActive(tenant, new Date(now.getTime() - 1095 * ONE_DAY_MS));

    const handler = createAuditLogRetentionHandler({
      db,
      resolver,
      logger: pino({ level: 'silent' }),
      now: () => now,
    });
    await handler();
    expect(db.__getRows().map((r) => r.id)).toEqual(['a2']);
  });

  it('enforces a 365-day floor even when policy goes below', async () => {
    const tenant = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const now = new Date('2026-04-30T04:00:00Z');
    // Row at 200 days old; even with policy=30, the 365-day floor protects it.
    const db = buildFakeDb([
      { id: 'a1', tenantId: tenant, createdAt: new Date(now.getTime() - 200 * ONE_DAY_MS) },
    ]);
    const resolver: AuditLogRetentionResolver = {
      listTenants: async (region) =>
        region === 'us' ? [{ tenantId: tenant, policy: { retentionDays: 30 } }] : [],
    };
    db.__setActive(tenant, new Date(now.getTime() - 365 * ONE_DAY_MS));

    const handler = createAuditLogRetentionHandler({
      db,
      resolver,
      logger: pino({ level: 'silent' }),
      now: () => now,
    });
    await handler();
    expect(db.__getRows()).toHaveLength(1);
  });

  it('continues to the next tenant when one tenant throws', async () => {
    const a = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const b = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const now = new Date('2026-04-30T04:00:00Z');
    const db = buildFakeDb([
      { id: 'a1', tenantId: a, createdAt: new Date(now.getTime() - 5 * 365 * ONE_DAY_MS) },
      { id: 'b1', tenantId: b, createdAt: new Date(now.getTime() - 5 * 365 * ONE_DAY_MS) },
    ]);
    let callCount = 0;
    db.transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      callCount += 1;
      if (callCount === 1) throw new Error('lock contention');
      // Second call (tenant b) — succeed by simulating a delete.
      return cb({
        delete: () => ({
          where: () => ({
            returning: async () => [{ id: 'b1' }],
          }),
        }),
        execute: async () => undefined,
      });
    }) as unknown as typeof db.transaction;
    const resolver: AuditLogRetentionResolver = {
      listTenants: async (region) =>
        region === 'us'
          ? [
              { tenantId: a, policy: { retentionDays: 1095 } },
              { tenantId: b, policy: { retentionDays: 1095 } },
            ]
          : [],
    };
    const handler = createAuditLogRetentionHandler({
      db,
      resolver,
      logger: pino({ level: 'silent' }),
      now: () => now,
    });
    await expect(handler()).resolves.toBeUndefined();
    expect(callCount).toBe(2);
  });
});
