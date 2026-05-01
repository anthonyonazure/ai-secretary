import { randomUUID } from 'node:crypto';
import type { Db } from '@aisecretary/db';
import type { NotificationRequest } from '@aisecretary/notifications';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import {
  computeReEngagementDedupKey,
  createReEngagementScanHandler,
} from './re-engagement-scan.js';

interface TenantStub {
  id: string;
  slug: string;
  name: string;
  region: 'us' | 'eu';
}

interface UserStub {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  createdAt: Date;
}

/**
 * Build a fake `Db` whose `select(...).from(tenants)` returns the
 * configured tenant list and whose tenant-scoped queries (inside
 * `withTenantContext`/`withJobContext` → `db.transaction(...)`) match
 * users-without-recordings off the configured user/recording arrays.
 *
 * The real Drizzle handle stitches these together via SQL; the
 * scheduler test exercises the iteration logic, dedup-key shape and
 * the enqueue payload — not the SQL itself, so a typed shim is
 * sufficient.
 */
const buildFakeDb = (input: {
  tenants: TenantStub[];
  /** Per-tenant user lists. Map: tenantId → users. */
  usersByTenant: Map<string, UserStub[]>;
  /** Per-tenant set of userIds that have recordings (excluded from match). */
  usersWithRecordings: Map<string, Set<string>>;
}): Db => {
  // Top-level `db.select().from(tenants)` returns the tenants array.
  const tenantSelect = {
    from: vi.fn(async () => input.tenants),
  };

  /**
   * Tenant-scoped `tx.select(...).from(users).where(...)` returns the
   * matching users for the most-recently-set tenant. We thread the
   * tenant id through `db.transaction(...)` via a captured variable.
   */
  let activeTenantId: string | null = null;

  const txStub = {
    execute: vi.fn(async () => undefined),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => {
          if (!activeTenantId) return [];
          const tenantUsers = input.usersByTenant.get(activeTenantId) ?? [];
          const withRec = input.usersWithRecordings.get(activeTenantId) ?? new Set<string>();
          return tenantUsers.filter((u) => !withRec.has(u.id));
        }),
      })),
    })),
  };

  const db = {
    select: vi.fn(() => tenantSelect),
    transaction: vi.fn(async (cb: (tx: typeof txStub) => Promise<unknown>) => {
      // The tenant id flows in via withTenantContext's `set_config(...)`
      // which our shim doesn't run; instead we capture it from the
      // most recent `boss.send`-equivalent path. We sniff the
      // surrounding closure via a direct hook below — see the
      // `setActiveTenant` helper.
      return cb(txStub);
    }),
  } as unknown as Db & { __setActiveTenant: (tenantId: string) => void };

  (db as unknown as { __setActiveTenant: (tenantId: string) => void }).__setActiveTenant = (
    tenantId: string,
  ) => {
    activeTenantId = tenantId;
  };

  return db;
};

const silentLogger = pino({ level: 'silent' });

describe('createReEngagementScanHandler (Story 1.7)', () => {
  it('enqueues a 24h email for users created ~24h ago with no recordings', async () => {
    const tenantId = randomUUID();
    const userId = randomUUID();
    const now = new Date('2026-04-29T12:00:00Z');
    const tenant: TenantStub = {
      id: tenantId,
      slug: 'acme',
      name: 'Acme Inc',
      region: 'us',
    };
    const user: UserStub = {
      id: userId,
      tenantId,
      email: 'newbie@acme.test',
      name: 'Newbie',
      // 24h ago — squarely in the bucket.
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    };

    const db = buildFakeDb({
      tenants: [tenant],
      usersByTenant: new Map([[tenantId, [user]]]),
      usersWithRecordings: new Map(),
    });

    // Monkey-patch the transaction to set active-tenant before running
    // the inner callback (real Drizzle does this via set_config).
    const originalTransaction = db.transaction;
    (db as unknown as { transaction: typeof originalTransaction }).transaction = vi.fn(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        (db as unknown as { __setActiveTenant: (id: string) => void }).__setActiveTenant(tenantId);
        return originalTransaction.call(db, cb as never);
      },
    );

    const enqueued: NotificationRequest[] = [];
    const handler = createReEngagementScanHandler({
      db,
      logger: silentLogger,
      enqueueNotification: async (req) => {
        enqueued.push(req);
      },
      now: () => now,
    });

    const result = await handler();
    expect(result.tenantsScanned).toBe(1);
    // The fake-db shim doesn't filter by createdAt window, so both the
    // 24h and 72h scans surface the same user. The 24h enqueue is the
    // one we care about — assert on its presence + shape.
    const req24 = enqueued.find((r) => r.kind === 're-engagement-24h');
    expect(req24).toBeDefined();
    if (!req24) throw new Error('expected req24');
    expect(req24.tenantId).toBe(tenantId);
    expect(req24.recipient.channel).toBe('email');
    if (req24.recipient.channel === 'email') {
      expect(req24.recipient.email).toBe('newbie@acme.test');
    }
    expect(req24.dedupKey).toContain('reengagement:24h:user-');
    expect(req24.dedupKey).toContain(userId);
    expect(result.enqueuedCount).toBeGreaterThanOrEqual(1);
  });

  it('enqueues a 72h email for users created ~72h ago with no recordings', async () => {
    const tenantId = randomUUID();
    const userId = randomUUID();
    const now = new Date('2026-04-29T12:00:00Z');
    const tenant: TenantStub = {
      id: tenantId,
      slug: 'acme',
      name: 'Acme',
      region: 'us',
    };
    const user: UserStub = {
      id: userId,
      tenantId,
      email: 'three-day@acme.test',
      name: 'Three Day',
      createdAt: new Date(now.getTime() - 72 * 60 * 60 * 1000),
    };

    const db = buildFakeDb({
      tenants: [tenant],
      // Trick the shim into returning the user only for the 72h scan
      // window — we always return the same list; the bucket logic
      // reads the same pool for both buckets, so the test still asserts
      // on the kind ('re-engagement-72h') for the latest enqueued event.
      usersByTenant: new Map([[tenantId, [user]]]),
      usersWithRecordings: new Map(),
    });

    const originalTransaction = db.transaction;
    (db as unknown as { transaction: typeof originalTransaction }).transaction = vi.fn(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        (db as unknown as { __setActiveTenant: (id: string) => void }).__setActiveTenant(tenantId);
        return originalTransaction.call(db, cb as never);
      },
    );

    const enqueued: NotificationRequest[] = [];
    const handler = createReEngagementScanHandler({
      db,
      logger: silentLogger,
      enqueueNotification: async (req) => {
        enqueued.push(req);
      },
      now: () => now,
    });

    await handler();
    // Both bucket scans see the same shim result, but the kind is
    // bucket-scoped — the 72h enqueue is the one we care about.
    const r72 = enqueued.find((r) => r.kind === 're-engagement-72h');
    expect(r72).toBeDefined();
    expect(r72?.dedupKey).toContain('reengagement:72h:user-');
  });

  it('skips users who already have a recording', async () => {
    const tenantId = randomUUID();
    const userId = randomUUID();
    const now = new Date('2026-04-29T12:00:00Z');
    const tenant: TenantStub = {
      id: tenantId,
      slug: 'acme',
      name: 'Acme',
      region: 'us',
    };
    const user: UserStub = {
      id: userId,
      tenantId,
      email: 'engaged@acme.test',
      name: 'Engaged',
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    };

    const db = buildFakeDb({
      tenants: [tenant],
      usersByTenant: new Map([[tenantId, [user]]]),
      usersWithRecordings: new Map([[tenantId, new Set([userId])]]),
    });

    const originalTransaction = db.transaction;
    (db as unknown as { transaction: typeof originalTransaction }).transaction = vi.fn(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        (db as unknown as { __setActiveTenant: (id: string) => void }).__setActiveTenant(tenantId);
        return originalTransaction.call(db, cb as never);
      },
    );

    const enqueued: NotificationRequest[] = [];
    const handler = createReEngagementScanHandler({
      db,
      logger: silentLogger,
      enqueueNotification: async (req) => {
        enqueued.push(req);
      },
      now: () => now,
    });

    const result = await handler();
    expect(result.enqueuedCount).toBe(0);
    expect(enqueued).toHaveLength(0);
  });

  it('iterates multiple tenants', async () => {
    const t1 = { id: randomUUID(), slug: 'a', name: 'A', region: 'us' as const };
    const t2 = { id: randomUUID(), slug: 'b', name: 'B', region: 'eu' as const };
    const now = new Date('2026-04-29T12:00:00Z');

    const db = buildFakeDb({
      tenants: [t1, t2],
      usersByTenant: new Map([
        [t1.id, []],
        [t2.id, []],
      ]),
      usersWithRecordings: new Map(),
    });

    const enqueued: NotificationRequest[] = [];
    const handler = createReEngagementScanHandler({
      db,
      logger: silentLogger,
      enqueueNotification: async (req) => {
        enqueued.push(req);
      },
      now: () => now,
    });

    const result = await handler();
    expect(result.tenantsScanned).toBe(2);
    expect(result.enqueuedCount).toBe(0);
  });
});

describe('computeReEngagementDedupKey', () => {
  it('produces stable keys per (bucket, userId, day)', () => {
    const userId = '00000000-0000-0000-0000-000000000001';
    const k = computeReEngagementDedupKey({
      bucket: '24h',
      userId,
      now: new Date('2026-04-29T12:34:56Z'),
    });
    expect(k).toBe('reengagement:24h:user-00000000-0000-0000-0000-000000000001:day-20260429');
  });

  it('rolls forward on the next UTC day', () => {
    const userId = '00000000-0000-0000-0000-000000000001';
    const before = computeReEngagementDedupKey({
      bucket: '72h',
      userId,
      now: new Date('2026-04-29T23:59:59Z'),
    });
    const after = computeReEngagementDedupKey({
      bucket: '72h',
      userId,
      now: new Date('2026-04-30T00:00:01Z'),
    });
    expect(before).not.toBe(after);
    expect(before).toContain('day-20260429');
    expect(after).toContain('day-20260430');
  });
});
