import { describe, expect, it } from 'vitest';

import { deriveRateLimitTimer } from './use-rate-limit-timer.js';

describe('deriveRateLimitTimer', () => {
  it('returns "locked" with the full window remaining at lockedAt', () => {
    const lockedAt = 1_700_000_000_000;
    const r = deriveRateLimitTimer({
      retryAfterSeconds: 30,
      lockedAtMs: lockedAt,
      now: lockedAt,
    });
    expect(r.state).toBe('locked');
    expect(r.secondsRemaining).toBe(30);
    expect(r.label).toBe('Retry in 30s');
  });

  it('counts down as time elapses', () => {
    const lockedAt = 1_700_000_000_000;
    const r = deriveRateLimitTimer({
      retryAfterSeconds: 30,
      lockedAtMs: lockedAt,
      now: lockedAt + 12_000,
    });
    expect(r.state).toBe('locked');
    expect(r.secondsRemaining).toBe(18);
    expect(r.label).toBe('Retry in 18s');
  });

  it('flips to "unlocked" when the window elapses', () => {
    const lockedAt = 1_700_000_000_000;
    const r = deriveRateLimitTimer({
      retryAfterSeconds: 30,
      lockedAtMs: lockedAt,
      now: lockedAt + 31_000,
    });
    expect(r.state).toBe('unlocked');
    expect(r.secondsRemaining).toBe(0);
    expect(r.label).toBe('Try again');
  });

  it('treats zero retry-after as unlocked immediately', () => {
    const r = deriveRateLimitTimer({
      retryAfterSeconds: 0,
      lockedAtMs: 1_700_000_000_000,
    });
    expect(r.state).toBe('unlocked');
  });

  it('clamps negative elapsed (clock drift)', () => {
    const lockedAt = 1_700_000_000_000;
    const r = deriveRateLimitTimer({
      retryAfterSeconds: 10,
      lockedAtMs: lockedAt,
      now: lockedAt - 5_000,
    });
    // Drift → no elapsed time → 10s remaining.
    expect(r.secondsRemaining).toBe(10);
  });
});
