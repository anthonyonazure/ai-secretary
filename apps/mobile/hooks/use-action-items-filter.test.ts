import type { ActionItemRow } from '@aisecretary/shared';
import { describe, expect, it } from 'vitest';

import { bucketActionItem, filterActionItems } from './use-action-items-filter.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const buildItem = (overrides: Partial<ActionItemRow> = {}): ActionItemRow => ({
  id: '11111111-1111-1111-1111-111111111111',
  meetingId: '22222222-2222-2222-2222-222222222222',
  meetingTitle: 'Quarterly review',
  meetingRecordedAt: '2026-04-30T15:00:00.000Z',
  text: 'Send the SOC 2 questionnaire to Acme.',
  ownerName: 'Anthony',
  ownerUserId: null,
  dueDate: null,
  status: 'pending',
  confidence: 0.85,
  citations: [],
  createdAt: '2026-04-30T15:30:00.000Z',
  updatedAt: '2026-04-30T15:30:00.000Z',
  ...overrides,
});

describe('filterActionItems', () => {
  it('returns only pending + accepted on the open tab', () => {
    const rows = [
      buildItem({ id: '1', status: 'pending', text: 'a' }),
      buildItem({ id: '2', status: 'accepted', text: 'b' }),
      buildItem({ id: '3', status: 'done', text: 'c' }),
      buildItem({ id: '4', status: 'dismissed', text: 'd' }),
    ];
    const result = filterActionItems(rows, { tab: 'open' });
    expect(result.map((r) => r.text).sort()).toEqual(['a', 'b']);
  });

  it('returns only done items on the done tab', () => {
    const rows = [
      buildItem({ id: '1', status: 'pending' }),
      buildItem({ id: '2', status: 'done' }),
    ];
    const result = filterActionItems(rows, { tab: 'done' });
    expect(result).toHaveLength(1);
  });

  it('filters by meeting id', () => {
    const a = '11111111-1111-1111-1111-111111111111';
    const b = '22222222-2222-2222-2222-222222222222';
    const rows = [
      buildItem({ id: '1', meetingId: a, text: 'A' }),
      buildItem({ id: '2', meetingId: b, text: 'B' }),
    ];
    const result = filterActionItems(rows, { tab: 'all', meetingId: a });
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe('A');
  });

  it('filters by owner name (case-insensitive substring)', () => {
    const rows = [
      buildItem({ id: '1', ownerName: 'Casey Lee', text: 'casey item' }),
      buildItem({ id: '2', ownerName: 'Anthony', text: 'anthony item' }),
    ];
    const result = filterActionItems(rows, { tab: 'all', ownerName: 'casey' });
    expect(result.map((r) => r.text)).toEqual(['casey item']);
  });

  it('filters by free-text query against the action text', () => {
    const rows = [
      buildItem({ id: '1', text: 'Send the SOC 2 questionnaire' }),
      buildItem({ id: '2', text: 'Schedule the kickoff' }),
    ];
    const result = filterActionItems(rows, { tab: 'all', query: 'questionnaire' });
    expect(result).toHaveLength(1);
  });
});

describe('bucketActionItem', () => {
  const now = new Date('2026-04-30T16:00:00Z');

  it('returns "no-date" when dueDate is null', () => {
    expect(bucketActionItem(buildItem({ dueDate: null }), now)).toBe('no-date');
  });

  it('returns "overdue" when dueDate is in the past + still open', () => {
    expect(
      bucketActionItem(
        buildItem({ dueDate: new Date(now.getTime() - ONE_DAY_MS).toISOString() }),
        now,
      ),
    ).toBe('overdue');
  });

  it('returns "today" when dueDate is today', () => {
    expect(bucketActionItem(buildItem({ dueDate: '2026-04-30T08:00:00Z' }), now)).toBe('today');
  });

  it('returns "upcoming" when dueDate is in the future', () => {
    expect(
      bucketActionItem(
        buildItem({ dueDate: new Date(now.getTime() + 5 * ONE_DAY_MS).toISOString() }),
        now,
      ),
    ).toBe('upcoming');
  });

  it('treats "overdue" past dates as "no-date" if the item is already done', () => {
    expect(
      bucketActionItem(
        buildItem({
          status: 'done',
          dueDate: new Date(now.getTime() - ONE_DAY_MS).toISOString(),
        }),
        now,
      ),
    ).toBe('no-date');
  });
});
