import type { Db } from '@aisecretary/db';
import type { StorageProvider } from '@aisecretary/storage';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import {
  type RetentionPolicy,
  type RetentionPolicyResolver,
  createRetentionPurgeHandler,
} from './retention-purge.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface FakeRecording {
  id: string;
  tenantId: string;
  storageKey: string;
  createdAt: Date;
}

interface FakeMeeting {
  id: string;
  tenantId: string;
  createdAt: Date;
}

const buildFakeDb = (input: {
  recordings: FakeRecording[];
  meetings: FakeMeeting[];
}): Db & {
  __getRecordings: () => FakeRecording[];
  __getMeetings: () => FakeMeeting[];
} => {
  const recordingsArr = [...input.recordings];
  const meetingsArr = [...input.meetings];

  /**
   * Deterministic per-tenant call ordering inside one withJobContext:
   *   1. select(...).from(recordings).where(...)  → returns expired recordings list
   *   2. delete(recordings).where(...).returning() → deletes them
   *   3. delete(meetings).where(...).returning()    → deletes meetings
   *
   * The fake routes calls via a counter that resets at each tx start.
   */
  let txCallCounter = 0;
  let activeTenant: string | null = null;

  const txStub = {
    execute: vi.fn(async () => undefined),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => {
          // Call 1 of the tx — recordings select.
          txCallCounter += 1;
          if (!activeTenant) return [];
          const cutoff = mockState.audioCutoff;
          return recordingsArr.filter(
            (r) => r.tenantId === activeTenant && r.createdAt.getTime() <= cutoff.getTime(),
          );
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => {
          // Call 2 = recordings delete; call 3 = meetings delete.
          txCallCounter += 1;
          if (!activeTenant) return [];
          if (txCallCounter === 2) {
            const cutoff = mockState.audioCutoff;
            const remain: FakeRecording[] = [];
            const deleted: FakeRecording[] = [];
            for (const r of recordingsArr) {
              if (r.tenantId === activeTenant && r.createdAt.getTime() <= cutoff.getTime()) {
                deleted.push(r);
              } else {
                remain.push(r);
              }
            }
            recordingsArr.length = 0;
            recordingsArr.push(...remain);
            return deleted.map((r) => ({ id: r.id }));
          }
          // Meetings
          const cutoff = mockState.transcriptCutoff;
          const remain: FakeMeeting[] = [];
          const deleted: FakeMeeting[] = [];
          for (const m of meetingsArr) {
            if (m.tenantId === activeTenant && m.createdAt.getTime() <= cutoff.getTime()) {
              deleted.push(m);
            } else {
              remain.push(m);
            }
          }
          meetingsArr.length = 0;
          meetingsArr.push(...remain);
          return deleted.map((m) => ({ id: m.id }));
        }),
      })),
    })),
  };

  const mockState = {
    audioCutoff: new Date(0),
    transcriptCutoff: new Date(0),
  };

  const db = {
    select: vi.fn(() => txStub.select()),
    transaction: vi.fn(async (cb: (tx: typeof txStub) => Promise<unknown>) => {
      // Reset the per-tx call counter and capture the tenant the test
      // set up before this invocation.
      txCallCounter = 0;
      activeTenant = mockState.activeTenant;
      const result = await cb(txStub);
      activeTenant = null;
      return result;
    }),
    __getRecordings: () => recordingsArr,
    __getMeetings: () => meetingsArr,
  } as unknown as Db & {
    __getRecordings: () => FakeRecording[];
    __getMeetings: () => FakeMeeting[];
  };

  // Hand the test a way to set cutoffs + activeTenant before calling.
  Object.defineProperty(db, '__mockState', {
    value: mockState,
    enumerable: false,
    writable: false,
  });
  return db;
};

const buildFakeStorage = (): StorageProvider & { __deleted: string[] } => {
  const deleted: string[] = [];
  return {
    presignPut: vi.fn(),
    presignGet: vi.fn(),
    delete: vi.fn(async (key: string) => {
      deleted.push(key);
    }),
    initiateMultipart: vi.fn(),
    presignPart: vi.fn(),
    completeMultipart: vi.fn(),
    abortMultipart: vi.fn(),
    __deleted: deleted,
  } as unknown as StorageProvider & { __deleted: string[] };
};

describe('retention-purge handler', () => {
  it('purges recordings + meetings older than the cutoff', async () => {
    const tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const now = new Date('2026-04-30T12:00:00Z');
    const policy: RetentionPolicy = { audioDays: 30, transcriptDays: 90 };

    const db = buildFakeDb({
      recordings: [
        {
          id: 'r1',
          tenantId: tenant,
          storageKey: 'audio/r1.webm',
          createdAt: new Date(now.getTime() - 60 * ONE_DAY_MS),
        },
        {
          id: 'r2',
          tenantId: tenant,
          storageKey: 'audio/r2.webm',
          createdAt: new Date(now.getTime() - 5 * ONE_DAY_MS),
        },
      ],
      meetings: [
        {
          id: 'm1',
          tenantId: tenant,
          createdAt: new Date(now.getTime() - 100 * ONE_DAY_MS),
        },
        {
          id: 'm2',
          tenantId: tenant,
          createdAt: new Date(now.getTime() - 30 * ONE_DAY_MS),
        },
      ],
    });
    // @ts-expect-error — non-public test seam; see buildFakeDb.
    db.__mockState.audioCutoff = new Date(now.getTime() - policy.audioDays * ONE_DAY_MS);
    // @ts-expect-error
    db.__mockState.transcriptCutoff = new Date(now.getTime() - policy.transcriptDays * ONE_DAY_MS);
    // @ts-expect-error
    db.__mockState.activeTenant = tenant;

    const storage = buildFakeStorage();
    const resolver: RetentionPolicyResolver = {
      listTenants: async (region) => (region === 'us' ? [{ tenantId: tenant, policy }] : []),
    };

    const handler = createRetentionPurgeHandler({
      db,
      storage,
      logger: pino({ level: 'silent' }),
      resolver,
      now: () => now,
    });
    await handler();
    expect(storage.__deleted).toEqual(['audio/r1.webm']);
    expect(db.__getRecordings().map((r) => r.id)).toEqual(['r2']);
    expect(db.__getMeetings().map((m) => m.id)).toEqual(['m2']);
  });

  it('continues to the next tenant when storage.delete throws', async () => {
    const tenant = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const now = new Date('2026-04-30T12:00:00Z');
    const policy: RetentionPolicy = { audioDays: 1, transcriptDays: 365 };

    const db = buildFakeDb({
      recordings: [
        {
          id: 'r1',
          tenantId: tenant,
          storageKey: 'audio/r1.webm',
          createdAt: new Date(now.getTime() - 5 * ONE_DAY_MS),
        },
      ],
      meetings: [],
    });
    // @ts-expect-error
    db.__mockState.audioCutoff = new Date(now.getTime() - policy.audioDays * ONE_DAY_MS);
    // @ts-expect-error
    db.__mockState.transcriptCutoff = new Date(now.getTime() - policy.transcriptDays * ONE_DAY_MS);
    // @ts-expect-error
    db.__mockState.activeTenant = tenant;

    const storage: StorageProvider = {
      presignPut: vi.fn(),
      presignGet: vi.fn(),
      delete: vi.fn(async () => {
        throw new Error('S3 5xx');
      }),
      initiateMultipart: vi.fn(),
      presignPart: vi.fn(),
      completeMultipart: vi.fn(),
      abortMultipart: vi.fn(),
    } as unknown as StorageProvider;
    const resolver: RetentionPolicyResolver = {
      listTenants: async (region) => (region === 'us' ? [{ tenantId: tenant, policy }] : []),
    };
    const handler = createRetentionPurgeHandler({
      db,
      storage,
      logger: pino({ level: 'silent' }),
      resolver,
      now: () => now,
    });
    await expect(handler()).resolves.toBeUndefined();
    // The recording row was still removed (the row delete is the
    // source-of-truth gate; orphaned objects re-tried next run).
    expect(db.__getRecordings()).toEqual([]);
  });

  it('skips a tenant whose cutoffs leave nothing to purge', async () => {
    const tenant = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const now = new Date('2026-04-30T12:00:00Z');
    const policy: RetentionPolicy = { audioDays: 365, transcriptDays: 365 };
    const db = buildFakeDb({
      recordings: [
        {
          id: 'r1',
          tenantId: tenant,
          storageKey: 'audio/r1.webm',
          createdAt: new Date(now.getTime() - 30 * ONE_DAY_MS),
        },
      ],
      meetings: [],
    });
    // @ts-expect-error
    db.__mockState.audioCutoff = new Date(now.getTime() - policy.audioDays * ONE_DAY_MS);
    // @ts-expect-error
    db.__mockState.transcriptCutoff = new Date(now.getTime() - policy.transcriptDays * ONE_DAY_MS);
    // @ts-expect-error
    db.__mockState.activeTenant = tenant;
    const storage = buildFakeStorage();
    const resolver: RetentionPolicyResolver = {
      listTenants: async (region) => (region === 'us' ? [{ tenantId: tenant, policy }] : []),
    };
    const handler = createRetentionPurgeHandler({
      db,
      storage,
      logger: pino({ level: 'silent' }),
      resolver,
      now: () => now,
    });
    await handler();
    expect(db.__getRecordings()).toHaveLength(1);
    expect(storage.__deleted).toEqual([]);
  });
});
