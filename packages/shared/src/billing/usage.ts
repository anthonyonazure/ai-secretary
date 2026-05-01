/**
 * Story 13.4 — usage-vs-allowance derivation.
 *
 * Given a tenant's billing tier descriptor and the current period's
 * usage (`hoursUsed` + `seatCount`), this returns the gating signals
 * the upgrade nudges + entitlement plugin both consume:
 *   - `hoursRemaining` for the dashboard ribbon
 *   - `isOverQuota` for the AnalysisCard upsell + the new-meeting CTA
 *   - `seatHeadroom` for the F2-admin invite flow
 *
 * Pure function. No I/O. Server-side path reads `tenant_entitlements`
 * + `usage_period` rows; client-side path reads the same data over
 * `/api/v1/billing/usage`. Both call this helper.
 */

import type { BillingTierDescriptor } from '../schemas/billing.js';

export interface UsageInput {
  tier: BillingTierDescriptor;
  hoursUsed: number;
  seatCount: number;
  /** Whether the tenant is in trial — trial periods get a soft warn at 80% but never a hard block. */
  inTrial: boolean;
}

export interface UsageEval {
  hoursRemaining: number;
  hoursPercentUsed: number;
  seatHeadroom: number | null;
  isOverQuota: boolean;
  warningTier: 'none' | 'soft' | 'hard';
  copy: string;
}

const SOFT_WARNING_THRESHOLD = 0.8;

export const evaluateUsage = (input: UsageInput): UsageEval => {
  const { tier, hoursUsed, seatCount, inTrial } = input;
  const allowance = tier.hoursIncluded;
  const hoursRemaining = Math.max(0, allowance - hoursUsed);
  const hoursPercentUsed = allowance > 0 ? Math.min(1, hoursUsed / allowance) : 0;

  const seatHeadroom = tier.seatCeiling === null ? null : Math.max(0, tier.seatCeiling - seatCount);

  const isOverQuota = !inTrial && hoursUsed >= allowance;
  let warningTier: UsageEval['warningTier'] = 'none';
  if (isOverQuota) warningTier = 'hard';
  else if (hoursPercentUsed >= SOFT_WARNING_THRESHOLD) warningTier = 'soft';

  let copy = '';
  if (warningTier === 'hard') {
    copy = `You’ve used your ${allowance} hours this period. Upgrade to keep recording.`;
  } else if (warningTier === 'soft') {
    copy = `${Math.floor(hoursRemaining)} of ${allowance} hours remain.`;
  }

  return {
    hoursRemaining,
    hoursPercentUsed,
    seatHeadroom,
    isOverQuota,
    warningTier,
    copy,
  };
};
