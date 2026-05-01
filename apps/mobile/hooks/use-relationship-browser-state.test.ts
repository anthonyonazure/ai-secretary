import { describe, expect, it } from 'vitest';

import {
  type RelationshipNode,
  deriveRelationshipBrowserState,
  formatLastMeeting,
} from './use-relationship-browser-state.js';

const node = (overrides: Partial<RelationshipNode> = {}): RelationshipNode => ({
  id: 'n-1',
  displayName: 'Alice',
  kind: 'colleague',
  meetingCount: 3,
  lastMeetingAtMs: 1_700_000_000_000,
  ...overrides,
});

describe('deriveRelationshipBrowserState', () => {
  it('returns the empty-state copy when nothing matches a query', () => {
    const r = deriveRelationshipBrowserState({
      nodes: [node({ displayName: 'Alice' })],
      query: 'zzz',
      kindFilter: 'all',
      sortKey: 'name',
    });
    expect(r.totalCount).toBe(0);
    expect(r.emptyCopy).toMatch(/zzz/);
  });

  it('filters by kind', () => {
    const r = deriveRelationshipBrowserState({
      nodes: [node({ id: 'a', kind: 'colleague' }), node({ id: 'b', kind: 'customer' })],
      query: '',
      kindFilter: 'customer',
      sortKey: 'name',
    });
    expect(r.totalCount).toBe(1);
    expect(r.visibleNodes[0]?.id).toBe('b');
  });

  it('sorts by meetings (desc)', () => {
    const r = deriveRelationshipBrowserState({
      nodes: [
        node({ id: 'a', displayName: 'Alice', meetingCount: 1 }),
        node({ id: 'b', displayName: 'Bob', meetingCount: 5 }),
      ],
      query: '',
      kindFilter: 'all',
      sortKey: 'meetings',
    });
    expect(r.visibleNodes.map((n) => n.id)).toEqual(['b', 'a']);
  });

  it('sorts by recency (most recent first)', () => {
    const r = deriveRelationshipBrowserState({
      nodes: [
        node({ id: 'a', lastMeetingAtMs: 1_000 }),
        node({ id: 'b', lastMeetingAtMs: 100 }),
        node({ id: 'c', lastMeetingAtMs: null }),
      ],
      query: '',
      kindFilter: 'all',
      sortKey: 'recency',
    });
    expect(r.visibleNodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by name alphabetically', () => {
    const r = deriveRelationshipBrowserState({
      nodes: [node({ id: 'a', displayName: 'Bob' }), node({ id: 'b', displayName: 'Alice' })],
      query: '',
      kindFilter: 'all',
      sortKey: 'name',
    });
    expect(r.visibleNodes.map((n) => n.id)).toEqual(['b', 'a']);
  });

  it('returns kind-specific empty copy for an empty kind filter', () => {
    const r = deriveRelationshipBrowserState({
      nodes: [],
      query: '',
      kindFilter: 'patient',
      sortKey: 'name',
    });
    expect(r.emptyCopy).toMatch(/No patient relationships/);
  });

  it('returns the bootstrap empty-state copy when the whole tenant has no nodes', () => {
    const r = deriveRelationshipBrowserState({
      nodes: [],
      query: '',
      kindFilter: 'all',
      sortKey: 'name',
    });
    expect(r.emptyCopy).toMatch(/start one to begin/);
  });
});

describe('formatLastMeeting', () => {
  const now = 1_700_000_000_000;

  it('returns "No meetings yet" for null', () => {
    expect(formatLastMeeting(null, now)).toBe('No meetings yet');
  });

  it('returns "Today" for less than a day ago', () => {
    expect(formatLastMeeting(now - 60_000, now)).toBe('Today');
  });

  it('returns "Yesterday" for one day ago', () => {
    expect(formatLastMeeting(now - 24 * 60 * 60 * 1000, now)).toBe('Yesterday');
  });

  it('returns "N days ago" for a week or less', () => {
    expect(formatLastMeeting(now - 4 * 24 * 60 * 60 * 1000, now)).toBe('4 days ago');
  });

  it('returns "N week(s) ago" inside a month', () => {
    expect(formatLastMeeting(now - 21 * 24 * 60 * 60 * 1000, now)).toBe('3 weeks ago');
  });

  it('returns "N month(s) ago" past 30 days', () => {
    expect(formatLastMeeting(now - 90 * 24 * 60 * 60 * 1000, now)).toBe('3 months ago');
  });

  it('returns "N year(s) ago" past a year', () => {
    expect(formatLastMeeting(now - 800 * 24 * 60 * 60 * 1000, now)).toBe('2 years ago');
  });
});
