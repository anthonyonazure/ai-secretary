export type RelationshipKind =
  | 'colleague'
  | 'customer'
  | 'patient'
  | 'student'
  | 'client'
  | 'unknown';

export type RelationshipNode = {
  id: string;
  displayName: string;
  kind: RelationshipKind;
  meetingCount: number;
  lastMeetingAtMs: number | null;
};

export type RelationshipBrowserInput = {
  nodes: ReadonlyArray<RelationshipNode>;
  query: string;
  kindFilter: RelationshipKind | 'all';
  sortKey: 'meetings' | 'recency' | 'name';
  now?: number;
};

export type RelationshipBrowserState = {
  visibleNodes: ReadonlyArray<RelationshipNode>;
  totalCount: number;
  emptyCopy: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const deriveRelationshipBrowserState = (
  input: RelationshipBrowserInput,
): RelationshipBrowserState => {
  const trimmed = input.query.trim().toLowerCase();
  const filtered = input.nodes.filter((n) => {
    if (input.kindFilter !== 'all' && n.kind !== input.kindFilter) return false;
    if (trimmed.length > 0 && !n.displayName.toLowerCase().includes(trimmed)) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    if (input.sortKey === 'name') return a.displayName.localeCompare(b.displayName);
    if (input.sortKey === 'meetings') return b.meetingCount - a.meetingCount;
    return (b.lastMeetingAtMs ?? 0) - (a.lastMeetingAtMs ?? 0);
  });
  const totalCount = sorted.length;

  let emptyCopy: string | null = null;
  if (totalCount === 0) {
    if (trimmed.length > 0) {
      emptyCopy = `No relationships match “${trimmed}.”`;
    } else if (input.kindFilter !== 'all') {
      emptyCopy = `No ${input.kindFilter} relationships yet.`;
    } else {
      emptyCopy = 'You haven’t recorded any meetings yet — start one to begin building this view.';
    }
  }

  return {
    visibleNodes: sorted,
    totalCount,
    emptyCopy,
  };
};

export const formatLastMeeting = (
  lastMeetingAtMs: number | null,
  now: number = Date.now(),
): string => {
  if (lastMeetingAtMs === null) return 'No meetings yet';
  const diffDays = Math.floor((now - lastMeetingAtMs) / DAY_MS);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${diffDays < 14 ? '' : 's'} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${diffDays < 60 ? '' : 's'} ago`;
  const years = Math.floor(diffDays / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
};
