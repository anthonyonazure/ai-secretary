/**
 * `filterMeetings` — pure helper for the mobile inbox screen's
 * client-side filter row. Powers chips ("This week" / "Sales" / "With
 * Casey") that narrow the rendered list without round-tripping the
 * server.
 *
 * Server-side search (Story 7.2) handles cross-meeting full-text
 * search; this helper is for the cheap-to-derive narrowing already
 * available on the inbox payload.
 */

export type MeetingTimeFilter = 'today' | 'this-week' | 'older' | 'all';

export interface MeetingFilterRow {
  id: string;
  title: string;
  /** ISO 8601. */
  startedAt: string | null;
  /** Module id assigned to this meeting (general / sales / hr / etc.). */
  moduleId: string | null;
  /** Attendees; powers the people-filter chip. */
  attendeeNames: string[];
}

export interface MeetingFilterCriteria {
  time: MeetingTimeFilter;
  moduleId: string | null;
  attendeeName: string | null;
  /** Substring search applied last. */
  query: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (now: Date): number =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

export const filterMeetings = (
  rows: readonly MeetingFilterRow[],
  criteria: MeetingFilterCriteria,
  now: Date = new Date(),
): MeetingFilterRow[] => {
  const todayMidnight = startOfDay(now);
  const sevenDaysAgo = todayMidnight - 7 * ONE_DAY_MS;
  const queryLower = criteria.query.trim().toLowerCase();
  const attendeeLower = criteria.attendeeName?.toLowerCase().trim() ?? null;

  return rows.filter((row) => {
    if (criteria.moduleId && row.moduleId !== criteria.moduleId) return false;

    if (criteria.time !== 'all') {
      const t = row.startedAt ? new Date(row.startedAt).getTime() : Number.NaN;
      if (Number.isNaN(t)) return false;
      if (criteria.time === 'today' && t < todayMidnight) return false;
      if (criteria.time === 'this-week' && t < sevenDaysAgo) return false;
      if (criteria.time === 'older' && t >= sevenDaysAgo) return false;
    }

    if (attendeeLower) {
      const match = row.attendeeNames.some((n) => n.toLowerCase().includes(attendeeLower));
      if (!match) return false;
    }

    if (queryLower) {
      if (!row.title.toLowerCase().includes(queryLower)) return false;
    }

    return true;
  });
};
