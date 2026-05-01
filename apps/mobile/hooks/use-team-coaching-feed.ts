/**
 * `deriveTeamCoachingFeed` — derives the manager-coaching feed for the
 * team-lead surface. Mixes recent meetings + action items + flagged
 * notes from team members into a single time-sorted feed.
 *
 * Surveillance aesthetic explicitly avoided per UX spec: each entry
 * carries a "shared by" attribution and a clear coaching context.
 */

export type CoachingFeedEntryKind =
  | 'meeting-shared'
  | 'coaching-note-posted'
  | 'action-item-flagged'
  | 'analysis-low-confidence';

export type CoachingFeedEntry = {
  id: string;
  kind: CoachingFeedEntryKind;
  authorUserId: string;
  authorName: string;
  targetUserId: string;
  targetName: string;
  createdAtMs: number;
  meetingId: string | null;
  meetingTitle: string | null;
  body: string;
  /** Whether the manager has acknowledged / opened this entry. */
  acknowledgedAtMs: number | null;
};

export type CoachingFeedInput = {
  entries: ReadonlyArray<CoachingFeedEntry>;
  filter: 'all' | 'unread' | 'flagged';
  sinceMs: number | null;
  managerUserId: string;
};

export type CoachingFeedResult = {
  visible: ReadonlyArray<CoachingFeedEntry>;
  unreadCount: number;
};

export const deriveTeamCoachingFeed = (input: CoachingFeedInput): CoachingFeedResult => {
  const since = input.sinceMs;
  const candidates = input.entries.filter((entry) => {
    if (since !== null && entry.createdAtMs < since) return false;
    if (input.filter === 'unread' && entry.acknowledgedAtMs !== null) return false;
    if (
      input.filter === 'flagged' &&
      !(entry.kind === 'action-item-flagged' || entry.kind === 'analysis-low-confidence')
    )
      return false;
    return true;
  });

  const sorted = [...candidates].sort((a, b) => b.createdAtMs - a.createdAtMs);
  const unreadCount = input.entries.filter(
    (e) => e.acknowledgedAtMs === null && e.targetUserId !== input.managerUserId,
  ).length;

  return { visible: sorted, unreadCount };
};
