export type DeepLinkTarget =
  | { kind: 'meeting'; meetingId: string }
  | { kind: 'meeting-citation'; meetingId: string; turnId: string; spanStartMs: number }
  | { kind: 'action-item'; actionItemId: string }
  | { kind: 'share-token'; tokenHash: string }
  | { kind: 'consent-page' }
  | { kind: 'unknown'; raw: string };

export type DeepLinkInput = {
  url: string;
  baseHost: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;

export const resolveDeepLink = (input: DeepLinkInput): DeepLinkTarget => {
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return { kind: 'unknown', raw: input.url };
  }
  if (!parsed.hostname.endsWith(input.baseHost)) {
    return { kind: 'unknown', raw: input.url };
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { kind: 'unknown', raw: input.url };
  }
  if (segments[0] === 'meetings' && segments.length >= 2) {
    const meetingId = segments[1] ?? '';
    if (!UUID_RE.test(meetingId)) {
      return { kind: 'unknown', raw: input.url };
    }
    const turnId = parsed.searchParams.get('turn');
    const tParam = parsed.searchParams.get('t');
    if (turnId !== null && tParam !== null) {
      const spanStartMs = Number.parseInt(tParam, 10);
      if (Number.isFinite(spanStartMs) && spanStartMs >= 0) {
        return { kind: 'meeting-citation', meetingId, turnId, spanStartMs };
      }
    }
    return { kind: 'meeting', meetingId };
  }
  if (segments[0] === 'actions' && segments.length >= 2) {
    const actionItemId = segments[1] ?? '';
    if (!UUID_RE.test(actionItemId)) {
      return { kind: 'unknown', raw: input.url };
    }
    return { kind: 'action-item', actionItemId };
  }
  if (segments[0] === 'share' && segments.length >= 2) {
    const tokenHash = segments[1] ?? '';
    if (!SHA256_RE.test(tokenHash)) {
      return { kind: 'unknown', raw: input.url };
    }
    return { kind: 'share-token', tokenHash };
  }
  if (segments[0] === 'consent') {
    return { kind: 'consent-page' };
  }
  return { kind: 'unknown', raw: input.url };
};
