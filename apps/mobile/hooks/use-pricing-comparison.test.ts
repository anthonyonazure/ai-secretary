import type { BillingTierDescriptor } from '@aisecretary/shared';
import { describe, expect, it } from 'vitest';

import { derivePricingComparison } from './use-pricing-comparison.js';

const tiers: ReadonlyArray<BillingTierDescriptor> = [
  {
    id: 'free',
    name: 'Free',
    priceLabel: '$0',
    tagline: '',
    highlights: [],
    seatCeiling: 1,
    hoursIncluded: 5,
    enabledModuleIds: ['general'],
    recommended: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '$24',
    tagline: '',
    highlights: [],
    seatCeiling: 25,
    hoursIncluded: 40,
    enabledModuleIds: ['general', 'sales'],
    recommended: true,
  },
  {
    id: 'business',
    name: 'Business',
    priceLabel: '$48',
    tagline: '',
    highlights: [],
    seatCeiling: 250,
    hoursIncluded: 100,
    enabledModuleIds: ['general', 'sales', 'medical'],
    recommended: false,
  },
];

describe('derivePricingComparison', () => {
  it('marks the current tier on every row', () => {
    const r = derivePricingComparison({
      tiers,
      currentTierId: 'pro',
      features: [{ id: 'sales', label: 'Sales module', includedIn: ['pro', 'business'] }],
    });
    expect(r.rows).toHaveLength(1);
    const cells = r.rows[0]?.cells ?? [];
    const proCell = cells.find((c) => c.tierId === 'pro');
    expect(proCell?.state).toBe('current');
  });

  it('marks features as included or excluded by tier', () => {
    const r = derivePricingComparison({
      tiers,
      currentTierId: 'free',
      features: [{ id: 'medical', label: 'Medical module', includedIn: ['business'] }],
    });
    const cells = r.rows[0]?.cells ?? [];
    expect(cells.find((c) => c.tierId === 'free')?.state).toBe('current');
    expect(cells.find((c) => c.tierId === 'pro')?.state).toBe('excluded');
    expect(cells.find((c) => c.tierId === 'business')?.state).toBe('included');
  });

  it('returns the recommended tier id', () => {
    const r = derivePricingComparison({
      tiers,
      currentTierId: 'free',
      features: [],
    });
    expect(r.recommendedTierId).toBe('pro');
  });

  it('returns null when no tier is recommended', () => {
    const r = derivePricingComparison({
      tiers: tiers.map((t) => ({ ...t, recommended: false })),
      currentTierId: 'free',
      features: [],
    });
    expect(r.recommendedTierId).toBeNull();
  });

  it('reports upgradeAvailable for non-top tiers', () => {
    expect(
      derivePricingComparison({ tiers, currentTierId: 'free', features: [] }).upgradeAvailable,
    ).toBe(true);
  });

  it('reports upgradeAvailable=false at the top tier', () => {
    expect(
      derivePricingComparison({ tiers, currentTierId: 'business', features: [] }).upgradeAvailable,
    ).toBe(false);
  });
});
