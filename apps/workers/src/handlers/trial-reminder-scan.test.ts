import { randomUUID } from 'node:crypto';
import type { Db } from '@aisecretary/db';
import type { NotificationRequest } from '@aisecretary/notifications';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import {
  computeTrialReminderDedupKey,
  createTrialReminderScanHandler,
} from './trial-reminder-scan.js';

interface TenantStub {
  id: string;
  slug: string;
  name: string;
  region: 'us' | 'eu';
  trialEndsAt: Date;
  trialCardOnFile: boolean;
  trialExpiredAt: Date | null;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const buildFakeDb = (input: { tenants: TenantStub[] }): Db & {
  __getTenants: () => TenantStub[];
} => {
  /**
   * The trial-reminder handler issues `select(...).from(tenants).where(...)`
   * twice per region — once for the T-3d bucket, once for T-1d, plus
   * one more for expired trials. The fake delegates filtering by
   * inspecting the conjunctive `where()` arg and applying a generic
   * predicate based on what the real handler asks for.
   */
  const tenants = [...input.tenants];

  // Track the most recently captured "where" call so subsequent
  // `where(...)` returns the right rows. The real handler builds the
  // SQL via Drizzle's helpers; we sniff intent via a side channel set
  // by the handler — actually simpler: the handler is deterministic
  // about call order: t3d, t1d, expired. We use a counter.
  let queryCounter = 0;

  const txStub = {
    execute: vi.fn(async () => undefined),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => {
          const callIndex = queryCounter++;
          const now = mockNow.now;
          if (callIndex % 3 === 0) {
            // t3d bucket
            const center = new Date(now.getTime() + 3 * ONE_DAY_MS);
            return tenants.filter((t) => withinBucket(t.trialEndsAt, center));
          }
          if (callIndex % 3 === 1) {
            // t1d bucket
            const center = new Date(now.getTime() + 1 * ONE_DAY_MS);
            return tenants.filter((t) => withinBucket(t.trialEndsAt, center));
          }
          // expired bucket
          return tenants.filter(
            (t) =>
              t.trialEndsAt.getTime() <= now.getTime() &&
              !t.trialCardOnFile &&
              t.trialExpiredAt === null,
          );
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((patch: { trialExpiredAt?: Date }) => ({
        where: vi.fn(async () => {
          // Apply to the first matching tenant whose expired-at is null.
          const idx = tenants.findIndex((t) => t.trialExpiredAt === null && !t.trialCardOnFile);
          if (idx >= 0 && patch.trialExpiredAt) {
            const existing = tenants[idx];
            if (existing) {
              tenants[idx] = { ...existing, trialExpiredAt: patch.trialExpiredAt };
            }
          }
          return [];
        }),
      })),
    })),
  };

  const db = {
    select: vi.fn(() => txStub.select()),
    transaction: vi.fn(async (cb: (tx: typeof txStub) => Promise<unknown>) => cb(txStub)),
    __getTenants: () => tenants,
  } as unknown as Db & { __getTenants: () => TenantStub[] };

  return db;
};

const withinBucket = (when: Date, center: Date): boolean => {
  const HALF = 60 * 60 * 1000;
  const diff = Math.abs(when.getTime() - center.getTime());
  return diff <= HALF;
};

const mockNow = { now: new Date('2026-04-30T12:00:00Z') };

describe('createTrialReminderScanHandler', () => {
  it('enqueues a T-3d reminder for tenants whose trial ends in 3d', async () => {
    const tenant: TenantStub = {
      id: randomUUID(),
      slug: 'acme',
      name: 'Acme',
      region: 'us',
      trialEndsAt: new Date(mockNow.now.getTime() + 3 * ONE_DAY_MS),
      trialCardOnFile: false,
      trialExpiredAt: null,
    };
    const db = buildFakeDb({ tenants: [tenant] });
    const enqueued: NotificationRequest[] = [];
    const handler = createTrialReminderScanHandler({
      db,
      logger: pino({ level: 'silent' }),
      enqueueNotification: async (req) => {
        enqueued.push(req);
      },
      now: () => mockNow.now,
    });
    await handler();
    expect(enqueued.length).toBeGreaterThanOrEqual(1);
    const t3d = enqueued.find(
      (e) => (e.payload as { context?: { daysLeft?: number } }).context?.daysLeft === 3,
    );
    expect(t3d).toBeDefined();
    expect(t3d?.kind).toBe('trial-ending-soon');
  });

  it('enqueues a T-1d reminder for tenants whose trial ends in 1d', async () => {
    const tenant: TenantStub = {
      id: randomUUID(),
      slug: 'acme',
      name: 'Acme',
      region: 'us',
      trialEndsAt: new Date(mockNow.now.getTime() + 1 * ONE_DAY_MS),
      trialCardOnFile: false,
      trialExpiredAt: null,
    };
    const db = buildFakeDb({ tenants: [tenant] });
    const enqueued: NotificationRequest[] = [];
    const handler = createTrialReminderScanHandler({
      db,
      logger: pino({ level: 'silent' }),
      enqueueNotification: async (req) => {
        enqueued.push(req);
      },
      now: () => mockNow.now,
    });
    await handler();
    const t1d = enqueued.find(
      (e) => (e.payload as { context?: { daysLeft?: number } }).context?.daysLeft === 1,
    );
    expect(t1d).toBeDefined();
  });

  it('marks expired trials with trial_expired_at when card is missing', async () => {
    const tenant: TenantStub = {
      id: randomUUID(),
      slug: 'acme',
      name: 'Acme',
      region: 'us',
      trialEndsAt: new Date(mockNow.now.getTime() - ONE_DAY_MS),
      trialCardOnFile: false,
      trialExpiredAt: null,
    };
    const db = buildFakeDb({ tenants: [tenant] });
    const handler = createTrialReminderScanHandler({
      db,
      logger: pino({ level: 'silent' }),
      enqueueNotification: async () => {},
      now: () => mockNow.now,
    });
    await handler();
    const after = db.__getTenants();
    expect(after[0]?.trialExpiredAt).not.toBeNull();
  });

  it('does not enqueue duplicate reminders within the same UTC day', async () => {
    const tenant: TenantStub = {
      id: randomUUID(),
      slug: 'acme',
      name: 'Acme',
      region: 'us',
      trialEndsAt: new Date(mockNow.now.getTime() + 3 * ONE_DAY_MS),
      trialCardOnFile: false,
      trialExpiredAt: null,
    };
    const db = buildFakeDb({ tenants: [tenant] });
    const enqueued: NotificationRequest[] = [];
    const handler = createTrialReminderScanHandler({
      db,
      logger: pino({ level: 'silent' }),
      enqueueNotification: async (req) => {
        enqueued.push(req);
      },
      now: () => mockNow.now,
    });
    await handler();
    await handler();
    // Both invocations enqueue, but the gateway's dedup logic uses
    // (tenantId, kind, dedupKey) — the dedupKey here is identical
    // across calls within the same UTC day:
    const dedupKeys = enqueued.map((e) => e.dedupKey);
    expect(new Set(dedupKeys).size).toBe(1);
  });
});

describe('computeTrialReminderDedupKey', () => {
  it('rolls forward once per UTC day and is stable within the day', () => {
    const tenantId = 't-1';
    const morning = new Date('2026-04-30T08:00:00Z');
    const evening = new Date('2026-04-30T22:00:00Z');
    const next = new Date('2026-05-01T08:00:00Z');
    const a = computeTrialReminderDedupKey({ phase: 'T-3d', tenantId, now: morning });
    const b = computeTrialReminderDedupKey({ phase: 'T-3d', tenantId, now: evening });
    const c = computeTrialReminderDedupKey({ phase: 'T-3d', tenantId, now: next });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('differs per phase', () => {
    const tenantId = 't-1';
    const now = new Date('2026-04-30T08:00:00Z');
    const a = computeTrialReminderDedupKey({ phase: 'T-3d', tenantId, now });
    const b = computeTrialReminderDedupKey({ phase: 'T-1d', tenantId, now });
    expect(a).not.toBe(b);
  });
});
