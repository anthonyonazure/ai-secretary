import { describe, expect, it } from 'vitest';

import type { BillingTierDescriptor } from '../schemas/billing.js';
import { evaluateUsage } from './usage.js';

const proTier: BillingTierDescriptor = {
  id: 'pro',
  name: 'Pro',
  priceLabel: '$24',
  tagline: '',
  highlights: [],
  seatCeiling: 25,
  hoursIncluded: 40,
  enabledModuleIds: ['general'],
  recommended: false,
};

const enterpriseTier: BillingTierDescriptor = {
  ...proTier,
  id: 'enterprise',
  name: 'Enterprise',
  seatCeiling: null,
  hoursIncluded: 100_000,
};

describe('evaluateUsage', () => {
  it('returns no warning under 80% utilization', () => {
    const r = evaluateUsage({ tier: proTier, hoursUsed: 10, seatCount: 5, inTrial: false });
    expect(r.warningTier).toBe('none');
    expect(r.hoursRemaining).toBe(30);
    expect(r.copy).toBe('');
  });

  it('soft-warns at the 80% threshold', () => {
    const r = evaluateUsage({ tier: proTier, hoursUsed: 32, seatCount: 5, inTrial: false });
    expect(r.warningTier).toBe('soft');
    expect(r.copy).toMatch(/8 of 40 hours/);
  });

  it('hard-blocks at exactly the allowance', () => {
    const r = evaluateUsage({ tier: proTier, hoursUsed: 40, seatCount: 5, inTrial: false });
    expect(r.warningTier).toBe('hard');
    expect(r.isOverQuota).toBe(true);
    expect(r.hoursRemaining).toBe(0);
  });

  it('softens hard-block while in trial', () => {
    const r = evaluateUsage({ tier: proTier, hoursUsed: 50, seatCount: 5, inTrial: true });
    expect(r.warningTier).toBe('soft');
    expect(r.isOverQuota).toBe(false);
  });

  it('reports null seat headroom on enterprise (uncapped)', () => {
    const r = evaluateUsage({
      tier: enterpriseTier,
      hoursUsed: 1000,
      seatCount: 9_999,
      inTrial: false,
    });
    expect(r.seatHeadroom).toBeNull();
  });

  it('clamps hoursPercentUsed to a 0-1 range', () => {
    const r = evaluateUsage({ tier: proTier, hoursUsed: 80, seatCount: 1, inTrial: false });
    expect(r.hoursPercentUsed).toBe(1);
  });

  it('returns headroom for a capped tier', () => {
    const r = evaluateUsage({ tier: proTier, hoursUsed: 5, seatCount: 20, inTrial: false });
    expect(r.seatHeadroom).toBe(5);
  });
});
