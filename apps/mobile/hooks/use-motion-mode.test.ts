import { describe, expect, it } from 'vitest';

import { isMotionDisabled, resolveMotionMode } from './use-motion-mode.js';

describe('resolveMotionMode', () => {
  it('honors a user override above OS signals', () => {
    const r = resolveMotionMode({
      userOverride: 'reduced',
      osPrefersReducedMotion: false,
      osPrefersNoMotion: false,
    });
    expect(r.mode).toBe('reduced');
    expect(r.source).toBe('override');
    expect(r.shouldDisableMotion).toBe(true);
  });

  it('falls back to "off" when the OS forbids motion', () => {
    const r = resolveMotionMode({
      userOverride: null,
      osPrefersReducedMotion: false,
      osPrefersNoMotion: true,
    });
    expect(r.mode).toBe('off');
    expect(r.shouldDisableMotion).toBe(true);
  });

  it('falls back to "reduced" when the OS prefers reduced motion', () => {
    const r = resolveMotionMode({
      userOverride: null,
      osPrefersReducedMotion: true,
      osPrefersNoMotion: false,
    });
    expect(r.mode).toBe('reduced');
    expect(r.shouldDisableMotion).toBe(true);
  });

  it('returns "full" when no signals demand reduction', () => {
    const r = resolveMotionMode({
      userOverride: null,
      osPrefersReducedMotion: false,
      osPrefersNoMotion: false,
    });
    expect(r.mode).toBe('full');
    expect(r.shouldDisableMotion).toBe(false);
  });

  it('user override "full" overrides OS reduced-motion', () => {
    const r = resolveMotionMode({
      userOverride: 'full',
      osPrefersReducedMotion: true,
      osPrefersNoMotion: true,
    });
    expect(r.mode).toBe('full');
    expect(r.shouldDisableMotion).toBe(false);
  });
});

describe('isMotionDisabled', () => {
  it('returns true when motion should be skipped', () => {
    expect(
      isMotionDisabled({
        userOverride: null,
        osPrefersReducedMotion: true,
        osPrefersNoMotion: false,
      }),
    ).toBe(true);
  });

  it('returns false when full motion is allowed', () => {
    expect(
      isMotionDisabled({
        userOverride: null,
        osPrefersReducedMotion: false,
        osPrefersNoMotion: false,
      }),
    ).toBe(false);
  });
});
