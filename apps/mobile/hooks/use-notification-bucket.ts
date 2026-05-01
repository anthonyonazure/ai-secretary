/**
 * `useNotificationBucket` — mobile analog of the web NotificationBell
 * (Story 4.7) but adapted to React Native's mental model.
 *
 * The hook exposes:
 *   - `notifications` — the current in-app notification list
 *   - `unreadCount` — count of items with `unread === true`
 *   - `bucketByDay(now)` — pure function that groups items into
 *     "Today / Yesterday / Earlier" buckets for the screen's
 *     SectionList. Pulled out as a top-level export so it's
 *     testable under the mobile test runner (no RN renderer).
 *
 * Reasonable defaults:
 *   - 30-day TTL — older items are dropped from the bucket result
 *     (the server-side store is the source of truth, this is a
 *     UI-only window)
 *   - Unread-first sort within each bucket
 */

import type { InAppNotification } from './notification-types.js';

export type Bucket = 'today' | 'yesterday' | 'earlier';

export interface BucketedNotifications {
  today: InAppNotification[];
  yesterday: InAppNotification[];
  earlier: InAppNotification[];
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure function — buckets a notification list into Today / Yesterday /
 * Earlier relative to a `now` reference. Items older than 30 days
 * fall out (they're available in the server-side audit log if anyone
 * needs them; the UI keeps a tight window).
 */
export const bucketByDay = (
  notifications: readonly InAppNotification[],
  now: Date = new Date(),
): BucketedNotifications => {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayMidnight = todayMidnight - ONE_DAY_MS;
  const earlierFloor = todayMidnight - 30 * ONE_DAY_MS;

  const buckets: BucketedNotifications = { today: [], yesterday: [], earlier: [] };
  for (const n of notifications) {
    const t = new Date(n.createdAt).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= todayMidnight) {
      buckets.today.push(n);
    } else if (t >= yesterdayMidnight) {
      buckets.yesterday.push(n);
    } else if (t >= earlierFloor) {
      buckets.earlier.push(n);
    }
    // Older than 30d → dropped from the UI.
  }
  // Unread-first sort within each bucket; tiebreak by created-at desc.
  for (const bucket of [buckets.today, buckets.yesterday, buckets.earlier]) {
    bucket.sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
  return buckets;
};

export const countUnread = (notifications: readonly InAppNotification[]): number =>
  notifications.filter((n) => n.unread).length;
