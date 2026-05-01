import { describe, expect, it } from 'vitest';

import { deriveUserOnboardingProgress } from './use-onboarding-progress.js';

const blank = {
  hasOpenedInbox: false,
  viewedSampleAtMs: null,
  firstRecordingAtMs: null,
  firstReceiptViewedAtMs: null,
  submittedThumbsAtMs: null,
  setNotificationPrefsAtMs: null,
};

describe('deriveUserOnboardingProgress', () => {
  it('starts at 0% with everything pending', () => {
    const r = deriveUserOnboardingProgress(blank);
    expect(r.percent).toBe(0);
    expect(r.completed).toHaveLength(0);
  });

  it('advances as milestones complete', () => {
    const r = deriveUserOnboardingProgress({
      ...blank,
      hasOpenedInbox: true,
      viewedSampleAtMs: 1_700_000_000_000,
    });
    expect(r.percent).toBe(33);
    expect(r.completed).toContain('opened-inbox');
    expect(r.completed).toContain('viewed-sample');
  });

  it('returns 100% with all milestones', () => {
    const r = deriveUserOnboardingProgress({
      hasOpenedInbox: true,
      viewedSampleAtMs: 1,
      firstRecordingAtMs: 1,
      firstReceiptViewedAtMs: 1,
      submittedThumbsAtMs: 1,
      setNotificationPrefsAtMs: 1,
    });
    expect(r.percent).toBe(100);
    expect(r.remaining).toHaveLength(0);
    expect(r.nextNudge).toBeNull();
  });

  it('emits a nudge for the next remaining milestone with copy', () => {
    const r = deriveUserOnboardingProgress({ ...blank, hasOpenedInbox: true });
    expect(r.nextNudge?.milestone).toBe('viewed-sample');
    expect(r.nextNudge?.copy).toMatch(/sample meeting/);
  });

  it('skips a nudge for the empty-copy "opened-inbox" milestone', () => {
    const r = deriveUserOnboardingProgress(blank);
    expect(r.nextNudge).toBeNull();
  });
});
