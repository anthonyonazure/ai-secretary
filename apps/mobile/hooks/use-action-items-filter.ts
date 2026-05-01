/**
 * `filterActionItems` — pure helper for the mobile My Actions screen
 * (parallel to the web Story 8.5 surface). Powers the open / done /
 * all toggle plus a meeting filter and a free-text query.
 */

import type { ActionItemRow } from '@aisecretary/shared';

export type ActionItemTab = 'open' | 'done' | 'all';

export interface ActionItemFilterCriteria {
  tab: ActionItemTab;
  meetingId?: string | null;
  ownerName?: string | null;
  query?: string;
}

const TAB_TO_STATUSES: Record<ActionItemTab, ReadonlyArray<ActionItemRow['status']>> = {
  open: ['pending', 'accepted'],
  done: ['done'],
  all: ['pending', 'accepted', 'done', 'dismissed'],
};

export const filterActionItems = (
  rows: readonly ActionItemRow[],
  criteria: ActionItemFilterCriteria,
): ActionItemRow[] => {
  const allowedStatuses = new Set(TAB_TO_STATUSES[criteria.tab]);
  const queryLower = criteria.query?.trim().toLowerCase() ?? '';
  const ownerLower = criteria.ownerName?.toLowerCase().trim() ?? null;
  return rows.filter((row) => {
    if (!allowedStatuses.has(row.status)) return false;
    if (criteria.meetingId && row.meetingId !== criteria.meetingId) return false;
    if (ownerLower && (row.ownerName?.toLowerCase().includes(ownerLower) ?? false) === false) {
      return false;
    }
    if (queryLower && !row.text.toLowerCase().includes(queryLower)) {
      return false;
    }
    return true;
  });
};

/**
 * Pure helper that buckets action items into:
 *   - 'overdue' — dueDate < now, not done/dismissed
 *   - 'today'   — dueDate is today
 *   - 'upcoming' — dueDate is in the future
 *   - 'no-date' — no dueDate set
 */
export type ActionItemBucket = 'overdue' | 'today' | 'upcoming' | 'no-date';

export const bucketActionItem = (row: ActionItemRow, now: Date = new Date()): ActionItemBucket => {
  if (!row.dueDate) return 'no-date';
  const due = new Date(row.dueDate);
  if (Number.isNaN(due.getTime())) return 'no-date';
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrowMidnight = todayMidnight + 24 * 60 * 60 * 1000;
  const t = due.getTime();
  if (t < todayMidnight && row.status !== 'done' && row.status !== 'dismissed') {
    return 'overdue';
  }
  if (t >= todayMidnight && t < tomorrowMidnight) return 'today';
  if (t >= tomorrowMidnight) return 'upcoming';
  return 'no-date';
};
