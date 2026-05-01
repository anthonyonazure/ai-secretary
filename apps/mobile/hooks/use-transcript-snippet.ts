/**
 * `useTranscriptSnippet` — pure helper for the mobile search-result
 * snippet rendering.
 *
 * The Story 7.2 search endpoint returns server-rendered `<mark>`
 * markup; mobile RN doesn't have an HTML renderer so we translate
 * `<mark>...</mark>` into a parts array the screen can render with
 * native `<Text>` styled segments.
 */

export interface SnippetPart {
  text: string;
  /** True when this segment was inside `<mark>...</mark>`. */
  highlighted: boolean;
}

const MARK_RE = /<mark>(.*?)<\/mark>/g;

export const parseSnippet = (snippet: string): SnippetPart[] => {
  if (!snippet) return [];
  const parts: SnippetPart[] = [];
  let cursor = 0;
  for (const match of snippet.matchAll(MARK_RE)) {
    const idx = match.index ?? 0;
    if (idx > cursor) {
      parts.push({ text: snippet.slice(cursor, idx), highlighted: false });
    }
    parts.push({ text: match[1] ?? '', highlighted: true });
    cursor = idx + match[0].length;
  }
  if (cursor < snippet.length) {
    parts.push({ text: snippet.slice(cursor), highlighted: false });
  }
  return parts;
};

/** Strip mark tags entirely — used for accessibility text labels. */
export const plainSnippet = (snippet: string): string =>
  snippet.replace(MARK_RE, (_, inner) => inner);

/** Truncate around the first highlighted span, with ellipsis. */
export const truncateAroundFirstHighlight = (snippet: string, surrounding = 80): string => {
  const match = MARK_RE.exec(snippet);
  if (!match) {
    if (snippet.length <= surrounding * 2) return snippet;
    return `${snippet.slice(0, surrounding * 2)}…`;
  }
  const idx = match.index;
  const start = Math.max(0, idx - surrounding);
  const end = Math.min(snippet.length, idx + match[0].length + surrounding);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < snippet.length ? '…' : '';
  return `${prefix}${snippet.slice(start, end)}${suffix}`;
};
