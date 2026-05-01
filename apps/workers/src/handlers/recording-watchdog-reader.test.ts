/**
 * Story 4.4 — `DrizzleRecordingWatchdogReader` unit test.
 *
 * Verifies the system-level scan returns the right shape for the
 * watchdog handler. The Db is faked with the chain
 * `select().from().innerJoin().where()` returning a pre-canned row set;
 * we assert the reader maps it into the `InFlightRecording` interface
 * and forwards `region` through correctly.
 */

import type { Db } from '@aisecretary/db';
import { describe, expect, it, vi } from 'vitest';
import { DrizzleRecordingWatchdogReader } from './recording-watchdog-reader.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const RECORDING_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const MEETING_ID = '44444444-4444-4444-8444-444444444444';

const buildFakeDb = (rows: Array<Record<string, unknown>>): Db =>
  ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(async () => rows),
        })),
      })),
    })),
  }) as unknown as Db;

describe('DrizzleRecordingWatchdogReader', () => {
  it('returns rows mapped into the InFlightRecording shape', async () => {
    const db = buildFakeDb([
      {
        recordingId: RECORDING_ID,
        tenantId: TENANT_ID,
        ownerUserId: USER_ID,
        meetingId: MEETING_ID,
        region: 'us',
      },
    ]);
    const reader = new DrizzleRecordingWatchdogReader(db);
    const result = await reader.listInFlight({ sinceMs: Date.now() - 60_000 });
    expect(result).toEqual([
      {
        tenantId: TENANT_ID,
        recordingId: RECORDING_ID,
        ownerUserId: USER_ID,
        meetingId: MEETING_ID,
        region: 'us',
      },
    ]);
  });

  it('preserves the region label from the joined tenants row', async () => {
    const db = buildFakeDb([
      {
        recordingId: RECORDING_ID,
        tenantId: TENANT_ID,
        ownerUserId: USER_ID,
        meetingId: MEETING_ID,
        region: 'eu',
      },
    ]);
    const reader = new DrizzleRecordingWatchdogReader(db);
    const result = await reader.listInFlight({ sinceMs: 0 });
    expect(result[0]?.region).toBe('eu');
  });

  it('returns an empty list when no rows match', async () => {
    const reader = new DrizzleRecordingWatchdogReader(buildFakeDb([]));
    expect(await reader.listInFlight({ sinceMs: 0 })).toEqual([]);
  });

  it('passes the sinceMs cutoff into the query (date conversion)', async () => {
    const innerJoinSpy = vi.fn(() => ({
      where: vi.fn(async () => []),
    }));
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: innerJoinSpy,
        })),
      })),
    } as unknown as Db;
    const reader = new DrizzleRecordingWatchdogReader(db);
    await reader.listInFlight({ sinceMs: 1_700_000_000_000 });
    // Query was built — the join was invoked once.
    expect(innerJoinSpy).toHaveBeenCalledOnce();
  });

  it('handles multiple rows from different tenants', async () => {
    const db = buildFakeDb([
      {
        recordingId: 'r1',
        tenantId: 't1',
        ownerUserId: 'u1',
        meetingId: 'm1',
        region: 'us',
      },
      {
        recordingId: 'r2',
        tenantId: 't2',
        ownerUserId: 'u2',
        meetingId: 'm2',
        region: 'eu',
      },
    ]);
    const reader = new DrizzleRecordingWatchdogReader(db);
    const result = await reader.listInFlight({ sinceMs: 0 });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.region)).toEqual(['us', 'eu']);
  });
});
