import { describe, expect, it } from 'vitest';

import type { InAppNotification } from './notification-types.js';
import { bucketByDay, countUnread } from './use-notification-bucket.js';

const _ONE_DAY_MS = 24 * 60 * 60 * 1000;

const buildNotification = (
  overrides: Partial<InAppNotification> & { createdAt: string },
): InAppNotification => ({
  id: 'n',
  kind: 'transcript-ready',
  title: 'Transcript ready',
  unread: true,
  ...overrides,
});

describe('countUnread', () => {
  it('counts items where unread = true', () => {
    expect(
      countUnread([
        buildNotification({ id: 'a', createdAt: new Date().toISOString() }),
        buildNotification({ id: 'b', createdAt: new Date().toISOString(), unread: false }),
        buildNotification({ id: 'c', createdAt: new Date().toISOString() }),
      ]),
    ).toBe(2);
  });
});

describe('bucketByDay', () => {
  // Use 4 PM UTC so we're always past midnight regardless of test
  // execution time zone.
  const now = new Date('2026-04-30T16:00:00Z');

  it('groups today / yesterday / earlier correctly', () => {
    const items = [
      buildNotification({ id: 'today', createdAt: '2026-04-30T10:00:00Z' }),
      buildNotification({ id: 'yesterday', createdAt: '2026-04-29T08:00:00Z' }),
      buildNotification({ id: 'last-week', createdAt: '2026-04-23T08:00:00Z' }),
    ];
    const result = bucketByDay(items, now);
    expect(result.today.map((n) => n.id)).toEqual(['today']);
    expect(result.yesterday.map((n) => n.id)).toEqual(['yesterday']);
    expect(result.earlier.map((n) => n.id)).toEqual(['last-week']);
  });

  it('drops items older than 30 days', () => {
    const items = [buildNotification({ id: 'old', createdAt: '2025-01-01T00:00:00Z' })];
    const result = bucketByDay(items, now);
    expect(result.today).toHaveLength(0);
    expect(result.yesterday).toHaveLength(0);
    expect(result.earlier).toHaveLength(0);
  });

  it('sorts unread-first within each bucket', () => {
    const items = [
      buildNotification({
        id: 'older-unread',
        createdAt: '2026-04-30T08:00:00Z',
        unread: true,
      }),
      buildNotification({
        id: 'newer-read',
        createdAt: '2026-04-30T15:00:00Z',
        unread: false,
      }),
      buildNotification({
        id: 'newer-unread',
        createdAt: '2026-04-30T14:00:00Z',
        unread: true,
      }),
    ];
    const result = bucketByDay(items, now);
    expect(result.today.map((n) => n.id)).toEqual(['newer-unread', 'older-unread', 'newer-read']);
  });

  it('skips items whose createdAt is unparseable', () => {
    const items = [
      buildNotification({ id: 'bad', createdAt: 'not-a-date' }),
      buildNotification({ id: 'good', createdAt: now.toISOString() }),
    ];
    const result = bucketByDay(items, now);
    expect(result.today.map((n) => n.id)).toEqual(['good']);
  });
});
