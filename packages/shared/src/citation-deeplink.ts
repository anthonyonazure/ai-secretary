/**
 * Canonical citation deep-link builder + parser.
 *
 * Per Story 3.5 + Story 2.4, the citation deep-link contract is
 * `(meetingId, turnId)`. The optional `t` param carries the
 * span-start in ms so the player can pre-roll without a server
 * round-trip; the server is the source-of-truth and may correct it.
 *
 * Format: `https://<host>/meetings/<meetingId>?turn=<turnId>&t=<ms>`
 *
 * Used by:
 *  - web AnalysisCard's citation chip onClick
 *  - mobile use-deep-link-resolver
 *  - share-token landing pages
 *  - email digests + chat-completion citation footnotes
 */

export interface CitationDeepLinkInput {
  meetingId: string;
  turnId: string | null;
  spanStartMs: number | null;
  /** App host without scheme — e.g., "acme.us.aisecretary.app". */
  host: string;
  /** Default https; pass http for local dev. */
  scheme?: 'http' | 'https';
}

export const buildCitationDeepLink = (input: CitationDeepLinkInput): string => {
  const scheme = input.scheme ?? 'https';
  const url = new URL(`${scheme}://${input.host}/meetings/${input.meetingId}`);
  if (input.turnId !== null) {
    url.searchParams.set('turn', input.turnId);
  }
  if (input.spanStartMs !== null) {
    url.searchParams.set('t', String(Math.max(0, Math.floor(input.spanStartMs))));
  }
  return url.toString();
};

export type ParsedCitationDeepLink = {
  meetingId: string;
  turnId: string | null;
  spanStartMs: number | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const parseCitationDeepLink = (url: string): ParsedCitationDeepLink | null => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2 || segments[0] !== 'meetings') return null;
  const meetingId = segments[1] ?? '';
  if (!UUID_RE.test(meetingId)) return null;
  const turnParam = parsed.searchParams.get('turn');
  const tParam = parsed.searchParams.get('t');
  const spanStartMs =
    tParam !== null && Number.isFinite(Number.parseInt(tParam, 10))
      ? Math.max(0, Number.parseInt(tParam, 10))
      : null;
  return {
    meetingId,
    turnId: turnParam,
    spanStartMs,
  };
};

/**
 * Compares two deep-links for citation equivalence (same meeting + turn,
 * ignoring host and `t` precision). Useful for dedup'ing citation chips
 * that point to the same span.
 */
export const isSameCitation = (a: string, b: string): boolean => {
  const pa = parseCitationDeepLink(a);
  const pb = parseCitationDeepLink(b);
  if (pa === null || pb === null) return false;
  return pa.meetingId === pb.meetingId && pa.turnId === pb.turnId;
};
