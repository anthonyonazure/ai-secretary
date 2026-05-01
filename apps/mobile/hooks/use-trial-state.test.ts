import { describe, expect, it } from 'vitest';

import { deriveTrialState } from './use-trial-state.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe('deriveTrialState', () => {
  it('returns "none" when there is no trial', () => {
    const r = deriveTrialState({
      trialKind: null,
      trialStartsAt: null,
      trialEndsAt: null,
      trialCardOnFile: false,
    });
    expect(r.banner).toBe('none');
    expect(r.copy).toBe('');
  });

  it('returns "active" when more than 3 days remain', () => {
    const now = 1_700_000_000_000;
    const r = deriveTrialState({
      trialKind: 'pro',
      trialStartsAt: new Date(now - 5 * ONE_DAY_MS).toISOString(),
      trialEndsAt: new Date(now + 7 * ONE_DAY_MS).toISOString(),
      trialCardOnFile: false,
      now,
    });
    expect(r.banner).toBe('active');
    expect(r.daysRemaining).toBe(7);
    expect(r.showUpgradeCta).toBe(false);
  });

  it('returns "ending-soon" inside the 3-day window', () => {
    const now = 1_700_000_000_000;
    const r = deriveTrialState({
      trialKind: 'pro',
      trialStartsAt: new Date(now - 11 * ONE_DAY_MS).toISOString(),
      trialEndsAt: new Date(now + 2 * ONE_DAY_MS).toISOString(),
      trialCardOnFile: false,
      now,
    });
    expect(r.banner).toBe('ending-soon');
    expect(r.daysRemaining).toBe(2);
    expect(r.showAddCardCta).toBe(true);
    expect(r.copy).toMatch(/2 days/);
  });

  it('returns "ending-today" when 0 days remain but the trial is not yet over', () => {
    const now = 1_700_000_000_000;
    const r = deriveTrialState({
      trialKind: 'pro',
      trialStartsAt: new Date(now - 14 * ONE_DAY_MS).toISOString(),
      trialEndsAt: new Date(now + 1000).toISOString(),
      trialCardOnFile: false,
      now,
    });
    expect(r.banner).toBe('ending-today');
    expect(r.copy).toBe('Trial ends today.');
  });

  it('returns "expired" once the trial-end date has passed', () => {
    const now = 1_700_000_000_000;
    const r = deriveTrialState({
      trialKind: 'pro',
      trialStartsAt: new Date(now - 20 * ONE_DAY_MS).toISOString(),
      trialEndsAt: new Date(now - ONE_DAY_MS).toISOString(),
      trialCardOnFile: false,
      now,
    });
    expect(r.banner).toBe('expired');
    expect(r.showAddCardCta).toBe(true);
    expect(r.copy).toMatch(/Add a card/);
  });

  it('does not show upgrade CTA on business / enterprise trials', () => {
    const now = 1_700_000_000_000;
    const biz = deriveTrialState({
      trialKind: 'business',
      trialStartsAt: new Date(now - 14 * ONE_DAY_MS).toISOString(),
      trialEndsAt: new Date(now - ONE_DAY_MS).toISOString(),
      trialCardOnFile: false,
      now,
    });
    expect(biz.showUpgradeCta).toBe(false);
    expect(biz.copy).toMatch(/Contact your admin/);
  });

  it('singularizes "1 day" copy', () => {
    const now = 1_700_000_000_000;
    const r = deriveTrialState({
      trialKind: 'pro',
      trialStartsAt: new Date(now - 13 * ONE_DAY_MS).toISOString(),
      trialEndsAt: new Date(now + 25 * 60 * 60 * 1000).toISOString(),
      trialCardOnFile: true,
      now,
    });
    expect(r.banner).toBe('ending-soon');
    expect(r.daysRemaining).toBe(1);
    expect(r.copy).toBe('Trial ends in 1 day.');
    expect(r.showAddCardCta).toBe(false);
  });
});
