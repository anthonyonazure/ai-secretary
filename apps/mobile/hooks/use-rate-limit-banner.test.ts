import { describe, expect, it } from 'vitest';

import { deriveRateLimitBanner } from './use-rate-limit-banner.js';

describe('deriveRateLimitBanner', () => {
  it('hides the banner when no recent rate-limits are active', () => {
    const r = deriveRateLimitBanner({ recent: [] });
    expect(r.showBanner).toBe(false);
  });

  it('shows the banner with cooldown seconds when an endpoint is throttled', () => {
    const now = 1_700_000_000_000;
    const r = deriveRateLimitBanner({
      recent: [{ endpoint: 'chat', retryAfterMs: 10_000, hitAtMs: now - 3_000 }],
      now,
    });
    expect(r.showBanner).toBe(true);
    expect(r.endpoint).toBe('chat');
    expect(r.cooldownSecondsRemaining).toBe(7);
  });

  it('hides expired rate-limit events', () => {
    const now = 1_700_000_000_000;
    const r = deriveRateLimitBanner({
      recent: [{ endpoint: 'chat', retryAfterMs: 5_000, hitAtMs: now - 6_000 }],
      now,
    });
    expect(r.showBanner).toBe(false);
  });

  it('prefers chat (highest priority) over list-meetings', () => {
    const now = 1_700_000_000_000;
    const r = deriveRateLimitBanner({
      recent: [
        { endpoint: 'list-meetings', retryAfterMs: 30_000, hitAtMs: now - 1_000 },
        { endpoint: 'chat', retryAfterMs: 10_000, hitAtMs: now - 2_000 },
      ],
      now,
    });
    expect(r.endpoint).toBe('chat');
  });

  it('breaks ties by recency when priorities match', () => {
    const now = 1_700_000_000_000;
    const r = deriveRateLimitBanner({
      recent: [
        { endpoint: 'chat', retryAfterMs: 10_000, hitAtMs: now - 5_000 },
        { endpoint: 'chat', retryAfterMs: 10_000, hitAtMs: now - 1_000 },
      ],
      now,
    });
    expect(r.cooldownSecondsRemaining).toBe(9);
  });

  it('renders copy with the endpoint name and remaining seconds', () => {
    const now = 1_700_000_000_000;
    const r = deriveRateLimitBanner({
      recent: [{ endpoint: 'search', retryAfterMs: 30_000, hitAtMs: now }],
      now,
    });
    expect(r.copy).toMatch(/search throttled/);
    expect(r.copy).toMatch(/30s/);
  });
});
