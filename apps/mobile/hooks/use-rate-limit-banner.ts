/**
 * `deriveRateLimitBanner` — composes the recently-encountered 429s
 * across endpoints into a single user-facing banner state.
 *
 * The mobile shell mounts one banner; this picks the most-actionable
 * recent rate-limit (e.g., chat throttling beats list-meeting throttling
 * because chat is in-flight and visible). When the cooldown elapses, the
 * banner auto-dismisses.
 */

export type RateLimitedEndpoint =
  | 'chat'
  | 'search'
  | 'list-meetings'
  | 'create-share'
  | 'submit-thumbs'
  | 'export';

export type RateLimitEvent = {
  endpoint: RateLimitedEndpoint;
  retryAfterMs: number;
  hitAtMs: number;
};

export type RateLimitInput = {
  recent: ReadonlyArray<RateLimitEvent>;
  now?: number;
};

export type RateLimitBannerResult = {
  showBanner: boolean;
  endpoint: RateLimitedEndpoint | null;
  cooldownSecondsRemaining: number;
  copy: string;
};

const ENDPOINT_PRIORITY: Record<RateLimitedEndpoint, number> = {
  chat: 5,
  search: 4,
  export: 3,
  'create-share': 2,
  'submit-thumbs': 1,
  'list-meetings': 0,
};

const ENDPOINT_COPY: Record<RateLimitedEndpoint, string> = {
  chat: 'Slow down — chat throttled.',
  search: 'Slow down — search throttled.',
  'list-meetings': 'Reload throttled — try again in a moment.',
  'create-share': 'Sharing throttled — wait a moment.',
  'submit-thumbs': 'Feedback throttled.',
  export: 'Exports throttled.',
};

export const deriveRateLimitBanner = (input: RateLimitInput): RateLimitBannerResult => {
  const now = input.now ?? Date.now();
  const active = input.recent.filter((e) => now < e.hitAtMs + e.retryAfterMs);
  if (active.length === 0) {
    return {
      showBanner: false,
      endpoint: null,
      cooldownSecondsRemaining: 0,
      copy: '',
    };
  }
  const top = [...active].sort((a, b) => {
    const pa = ENDPOINT_PRIORITY[a.endpoint];
    const pb = ENDPOINT_PRIORITY[b.endpoint];
    if (pb !== pa) return pb - pa;
    return b.hitAtMs - a.hitAtMs;
  })[0];
  if (top === undefined) {
    return {
      showBanner: false,
      endpoint: null,
      cooldownSecondsRemaining: 0,
      copy: '',
    };
  }
  const remainingMs = Math.max(0, top.hitAtMs + top.retryAfterMs - now);
  return {
    showBanner: true,
    endpoint: top.endpoint,
    cooldownSecondsRemaining: Math.ceil(remainingMs / 1000),
    copy: `${ENDPOINT_COPY[top.endpoint]} Try again in ${Math.ceil(remainingMs / 1000)}s.`,
  };
};
