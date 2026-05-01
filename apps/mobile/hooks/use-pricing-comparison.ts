/**
 * `derivePricingComparison` — derives the pricing-grid comparison
 * matrix for the upgrade screen. Highlights the recommended tier and
 * marks features as included / excluded / upgrade-required for the
 * current tier.
 *
 * Pure helper — host wires the actual upgrade CTAs.
 */

import type { BillingTierDescriptor } from '@aisecretary/shared';

export type PricingComparisonInput = {
  tiers: ReadonlyArray<BillingTierDescriptor>;
  currentTierId: BillingTierDescriptor['id'];
  features: ReadonlyArray<{
    id: string;
    label: string;
    /** Tiers that include this feature. */
    includedIn: ReadonlyArray<BillingTierDescriptor['id']>;
  }>;
};

export type PricingComparisonCell = {
  featureId: string;
  tierId: BillingTierDescriptor['id'];
  state: 'included' | 'excluded' | 'current';
};

export type PricingComparisonRow = {
  featureId: string;
  label: string;
  cells: ReadonlyArray<PricingComparisonCell>;
};

export type PricingComparisonResult = {
  rows: ReadonlyArray<PricingComparisonRow>;
  recommendedTierId: BillingTierDescriptor['id'] | null;
  upgradeAvailable: boolean;
};

export const derivePricingComparison = (input: PricingComparisonInput): PricingComparisonResult => {
  const recommended = input.tiers.find((t) => t.recommended) ?? null;
  const currentIdx = input.tiers.findIndex((t) => t.id === input.currentTierId);
  const upgradeAvailable = currentIdx >= 0 && currentIdx < input.tiers.length - 1;

  const rows: PricingComparisonRow[] = input.features.map((feature) => ({
    featureId: feature.id,
    label: feature.label,
    cells: input.tiers.map((tier) => ({
      featureId: feature.id,
      tierId: tier.id,
      state:
        tier.id === input.currentTierId
          ? 'current'
          : feature.includedIn.includes(tier.id)
            ? 'included'
            : 'excluded',
    })),
  }));

  return {
    rows,
    recommendedTierId: recommended?.id ?? null,
    upgradeAvailable,
  };
};
