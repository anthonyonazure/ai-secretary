import { describe, expect, it } from 'vitest';

import { type MeetingFilterRow, filterMeetings } from './use-meeting-filter.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const buildRow = (overrides: Partial<MeetingFilterRow> = {}): MeetingFilterRow => ({
  id: 'm',
  title: 'A meeting',
  startedAt: '2026-04-30T10:00:00Z',
  moduleId: 'general',
  attendeeNames: ['Anthony', 'Casey'],
  ...overrides,
});

describe('filterMeetings', () => {
  // 4 PM UTC reference so all date math lands well past midnight regardless
  // of test runner time zone.
  const now = new Date('2026-04-30T16:00:00Z');

  it('returns every row when criteria are all "no filter"', () => {
    const rows = [buildRow({ id: 'a' }), buildRow({ id: 'b' })];
    const result = filterMeetings(rows, {
      time: 'all',
      moduleId: null,
      attendeeName: null,
      query: '',
    });
    expect(result).toHaveLength(2);
  });

  it('filters by today', () => {
    const rows = [
      buildRow({ id: 'today', startedAt: '2026-04-30T10:00:00Z' }),
      buildRow({ id: 'yesterday', startedAt: '2026-04-29T10:00:00Z' }),
    ];
    const result = filterMeetings(
      rows,
      {
        time: 'today',
        moduleId: null,
        attendeeName: null,
        query: '',
      },
      now,
    );
    expect(result.map((r) => r.id)).toEqual(['today']);
  });

  it('filters by this-week (last 7 days)', () => {
    const rows = [
      buildRow({ id: 'today', startedAt: now.toISOString() }),
      buildRow({
        id: 'three-days-ago',
        startedAt: new Date(now.getTime() - 3 * ONE_DAY_MS).toISOString(),
      }),
      buildRow({
        id: 'eight-days-ago',
        startedAt: new Date(now.getTime() - 8 * ONE_DAY_MS).toISOString(),
      }),
    ];
    const result = filterMeetings(
      rows,
      {
        time: 'this-week',
        moduleId: null,
        attendeeName: null,
        query: '',
      },
      now,
    );
    expect(result.map((r) => r.id).sort()).toEqual(['three-days-ago', 'today']);
  });

  it('filters by module', () => {
    const rows = [
      buildRow({ id: 'sales', moduleId: 'sales' }),
      buildRow({ id: 'medical', moduleId: 'medical' }),
    ];
    const result = filterMeetings(
      rows,
      { time: 'all', moduleId: 'sales', attendeeName: null, query: '' },
      now,
    );
    expect(result.map((r) => r.id)).toEqual(['sales']);
  });

  it('filters by attendee name (case-insensitive substring)', () => {
    const rows = [
      buildRow({ id: 'with-casey', attendeeNames: ['Anthony', 'Casey Lee'] }),
      buildRow({ id: 'without', attendeeNames: ['Anthony', 'Sam'] }),
    ];
    const result = filterMeetings(
      rows,
      { time: 'all', moduleId: null, attendeeName: 'casey', query: '' },
      now,
    );
    expect(result.map((r) => r.id)).toEqual(['with-casey']);
  });

  it('filters by free-text query against the meeting title', () => {
    const rows = [
      buildRow({ id: 'a', title: 'Quarterly review' }),
      buildRow({ id: 'b', title: 'One-on-one' }),
    ];
    const result = filterMeetings(
      rows,
      { time: 'all', moduleId: null, attendeeName: null, query: 'review' },
      now,
    );
    expect(result.map((r) => r.id)).toEqual(['a']);
  });

  it('combines multiple filters as AND', () => {
    const rows = [
      buildRow({
        id: 'match',
        title: 'Sales review',
        moduleId: 'sales',
        attendeeNames: ['Casey'],
      }),
      buildRow({ id: 'wrong-module', title: 'Sales review', moduleId: 'general' }),
    ];
    const result = filterMeetings(
      rows,
      { time: 'all', moduleId: 'sales', attendeeName: 'casey', query: 'review' },
      now,
    );
    expect(result.map((r) => r.id)).toEqual(['match']);
  });
});
