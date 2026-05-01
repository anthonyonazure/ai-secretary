import { describe, expect, it } from 'vitest';

import { type CoachingFeedEntry, deriveTeamCoachingFeed } from './use-team-coaching-feed.js';

const entry = (overrides: Partial<CoachingFeedEntry> = {}): CoachingFeedEntry => ({
  id: 'e1',
  kind: 'meeting-shared',
  authorUserId: 'rep-1',
  authorName: 'Casey',
  targetUserId: 'mgr-1',
  targetName: 'Manager',
  createdAtMs: 1_700_000_000_000,
  meetingId: 'm-1',
  meetingTitle: 'Acme — discovery',
  body: 'New meeting available',
  acknowledgedAtMs: null,
  ...overrides,
});

describe('deriveTeamCoachingFeed', () => {
  it('sorts entries newest-first', () => {
    const r = deriveTeamCoachingFeed({
      entries: [
        entry({ id: 'a', createdAtMs: 1_000 }),
        entry({ id: 'b', createdAtMs: 3_000 }),
        entry({ id: 'c', createdAtMs: 2_000 }),
      ],
      filter: 'all',
      sinceMs: null,
      managerUserId: 'mgr-1',
    });
    expect(r.visible.map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('filters to unread when requested', () => {
    const r = deriveTeamCoachingFeed({
      entries: [
        entry({ id: 'a', acknowledgedAtMs: 1_000 }),
        entry({ id: 'b', acknowledgedAtMs: null }),
      ],
      filter: 'unread',
      sinceMs: null,
      managerUserId: 'mgr-1',
    });
    expect(r.visible.map((e) => e.id)).toEqual(['b']);
  });

  it('filters to flagged kinds when requested', () => {
    const r = deriveTeamCoachingFeed({
      entries: [
        entry({ id: 'a', kind: 'meeting-shared' }),
        entry({ id: 'b', kind: 'action-item-flagged' }),
        entry({ id: 'c', kind: 'analysis-low-confidence' }),
      ],
      filter: 'flagged',
      sinceMs: null,
      managerUserId: 'mgr-1',
    });
    expect(r.visible.map((e) => e.id).sort()).toEqual(['b', 'c']);
  });

  it('respects the sinceMs filter cutoff', () => {
    const r = deriveTeamCoachingFeed({
      entries: [entry({ id: 'a', createdAtMs: 1_000 }), entry({ id: 'b', createdAtMs: 5_000 })],
      filter: 'all',
      sinceMs: 3_000,
      managerUserId: 'mgr-1',
    });
    expect(r.visible.map((e) => e.id)).toEqual(['b']);
  });

  it('counts unread entries that target someone other than the manager', () => {
    const r = deriveTeamCoachingFeed({
      entries: [
        entry({ id: 'a', targetUserId: 'rep-2', acknowledgedAtMs: null }),
        entry({ id: 'b', targetUserId: 'mgr-1', acknowledgedAtMs: null }),
        entry({ id: 'c', targetUserId: 'rep-3', acknowledgedAtMs: 1 }),
      ],
      filter: 'all',
      sinceMs: null,
      managerUserId: 'mgr-1',
    });
    expect(r.unreadCount).toBe(1);
  });

  it('returns an empty list and zero count when nothing matches', () => {
    const r = deriveTeamCoachingFeed({
      entries: [],
      filter: 'all',
      sinceMs: null,
      managerUserId: 'mgr-1',
    });
    expect(r.visible).toEqual([]);
    expect(r.unreadCount).toBe(0);
  });
});
