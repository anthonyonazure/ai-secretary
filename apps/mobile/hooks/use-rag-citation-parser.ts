export type ParsedRagSegment = { kind: 'text'; text: string } | { kind: 'citation'; index: number };

const CITATION_RE = /\[cite:(\d+)\]/g;

export const parseRagResponse = (text: string): ReadonlyArray<ParsedRagSegment> => {
  if (text.length === 0) return [];
  const segments: ParsedRagSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(CITATION_RE)) {
    const index = match.index ?? -1;
    if (index < 0) continue;
    if (index > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, index) });
    }
    const parsed = Number.parseInt(match[1] ?? '0', 10);
    if (Number.isFinite(parsed)) {
      segments.push({ kind: 'citation', index: parsed });
    }
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) });
  }
  return segments;
};

export const countRagCitations = (text: string): number => {
  let count = 0;
  for (const _ of text.matchAll(CITATION_RE)) count += 1;
  return count;
};

export const isUngroundedClaim = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length < 12) return false;
  return countRagCitations(trimmed) === 0;
};
