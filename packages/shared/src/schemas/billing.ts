/**
 * Billing tier wire schemas — Stories 13.4 + 13.5 (FR40 substrate).
 *
 * Four tiers map onto entitlement axes per PRD §8. Plan IDs are
 * stable strings; Stripe price IDs (`stripePriceMonthlyId` /
 * `stripePriceAnnualId`) live alongside but are tenant-scoped at
 * billing time — not present in this static config.
 */

import { z } from 'zod';

export const billingTierIdSchema = z.enum(['free', 'pro', 'business', 'enterprise']);
export type BillingTierId = z.infer<typeof billingTierIdSchema>;

export const billingTierDescriptorSchema = z.object({
  id: billingTierIdSchema,
  /** Display label. */
  name: z.string(),
  /** Headline price line — "$0", "$24/seat/mo", "Talk to sales". */
  priceLabel: z.string(),
  /** One-line tagline. */
  tagline: z.string(),
  /** Three-to-five highlighted features for the comparison table. */
  highlights: z.array(z.string()),
  /** Seat ceiling — null when unlimited. */
  seatCeiling: z.number().int().nullable(),
  /** Monthly meeting hours included before overage. */
  hoursIncluded: z.number().int(),
  /** Set of module ids enabled by default for this tier. */
  enabledModuleIds: z.array(
    z.enum(['general', 'sales', 'hr', 'education', 'medical', 'support', 'pm', 'psychology']),
  ),
  /** True for the tier shown as "current best value" — drives the
   *  visual pop on the pricing table. */
  recommended: z.boolean().default(false),
});
export type BillingTierDescriptor = z.infer<typeof billingTierDescriptorSchema>;

export const billingTiersResponseSchema = z.object({
  tiers: z.array(billingTierDescriptorSchema),
});
export type BillingTiersResponse = z.infer<typeof billingTiersResponseSchema>;
