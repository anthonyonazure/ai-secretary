import { describe, expect, it } from 'vitest';

import { type AuditEntryShape, groupAuditEntries, tallyByResourceType } from './audit-grouping.js';

const entry = (overrides: Partial<AuditEntryShape> = {}): AuditEntryShape => ({
  id: 'e1',
  action: 'share.created',
  resourceType: 'share',
  resourceId: 'r1',
  actorUserId: 'u1',
  createdAt: '2026-04-30T12:00:00.000Z',
  ...overrides,
});

describe('groupAuditEntries', () => {
  it('collapses same-actor same-action entries inside the same window', () => {
    const r = groupAuditEntries({
      entries: [
        entry({ id: '1', createdAt: '2026-04-30T12:00:00.000Z' }),
        entry({ id: '2', createdAt: '2026-04-30T12:01:00.000Z' }),
        entry({ id: '3', createdAt: '2026-04-30T12:02:00.000Z' }),
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0]?.count).toBe(3);
    expect(r[0]?.sampleIds.length).toBe(3);
  });

  it('splits across different actors', () => {
    const r = groupAuditEntries({
      entries: [entry({ id: '1', actorUserId: 'a' }), entry({ id: '2', actorUserId: 'b' })],
    });
    expect(r).toHaveLength(2);
  });

  it('splits across different actions', () => {
    const r = groupAuditEntries({
      entries: [
        entry({ id: '1', action: 'share.created' }),
        entry({ id: '2', action: 'share.expired' }),
      ],
    });
    expect(r).toHaveLength(2);
  });

  it('honors a custom window', () => {
    const r = groupAuditEntries({
      entries: [
        entry({ id: '1', createdAt: '2026-04-30T12:00:00.000Z' }),
        entry({ id: '2', createdAt: '2026-04-30T12:00:30.000Z' }),
      ],
      windowMs: 60_000,
    });
    expect(r).toHaveLength(1);
    expect(r[0]?.count).toBe(2);
  });

  it('caps sampleIds at maxSamples', () => {
    const r = groupAuditEntries({
      entries: Array.from({ length: 100 }, (_, i) =>
        entry({ id: `${i}`, createdAt: '2026-04-30T12:00:00.000Z' }),
      ),
      maxSamples: 3,
    });
    expect(r[0]?.sampleIds.length).toBe(3);
    expect(r[0]?.count).toBe(100);
  });

  it('returns groups sorted newest-first', () => {
    const r = groupAuditEntries({
      entries: [
        entry({ id: '1', actorUserId: 'a', createdAt: '2026-04-30T12:00:00.000Z' }),
        entry({ id: '2', actorUserId: 'b', createdAt: '2026-04-30T13:00:00.000Z' }),
      ],
    });
    expect(r[0]?.actorUserId).toBe('b');
  });

  it('drops entries with malformed timestamps', () => {
    const r = groupAuditEntries({
      entries: [entry({ id: '1', createdAt: 'not-a-date' })],
    });
    expect(r).toHaveLength(0);
  });
});

describe('tallyByResourceType', () => {
  it('counts entries by resource type and sorts descending', () => {
    const r = tallyByResourceType([
      entry({ resourceType: 'meeting' }),
      entry({ resourceType: 'meeting' }),
      entry({ resourceType: 'meeting' }),
      entry({ resourceType: 'share' }),
      entry({ resourceType: 'share' }),
      entry({ resourceType: 'consent' }),
    ]);
    expect(r).toEqual([
      { resourceType: 'meeting', count: 3 },
      { resourceType: 'share', count: 2 },
      { resourceType: 'consent', count: 1 },
    ]);
  });

  it('returns an empty array for no entries', () => {
    expect(tallyByResourceType([])).toEqual([]);
  });
});
