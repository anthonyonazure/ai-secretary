/**
 * `PricingGrid` — Story 13.4 (FR40 substrate).
 *
 * Renders the four-tier comparison table from
 * `packages/shared/src/billing/tiers.ts`. The "current plan" is
 * passed in by the host so the grid can highlight the active tier;
 * upgrade-CTAs route to a Stripe-checkout-mocked link for now and
 * swap to real Stripe once Story 13.1 (webhook) ships.
 *
 * a11y:
 *   - role="list" + role="listitem" on the tier columns so assistive
 *     tech walks the grid as a single set
 *   - The "recommended" badge is announced via aria-label on the card
 */

import { BILLING_TIERS, type BillingTierDescriptor, type BillingTierId } from '@aisecretary/shared';
import { Check } from 'lucide-react';

export interface PricingGridProps {
  /** Active tier id — gets the "Current plan" treatment. */
  currentTierId?: BillingTierId;
  /** Called when the user clicks an upgrade button. Host wires the
   *  Stripe-checkout link or contact-sales flow per tier. */
  onSelect?: (tierId: BillingTierId) => void;
  /** Override the tier list (mostly for tests). */
  tiers?: ReadonlyArray<BillingTierDescriptor>;
}

const tierBadgeClass = (recommended: boolean, current: boolean): string => {
  if (current) return 'bg-success/15 text-success';
  if (recommended) return 'bg-accent text-bg';
  return 'hidden';
};

export function PricingGrid({ currentTierId, onSelect, tiers = BILLING_TIERS }: PricingGridProps) {
  return (
    <ul
      aria-label="Plan tiers"
      className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="pricing-grid"
    >
      {tiers.map((tier) => {
        const isCurrent = tier.id === currentTierId;
        const isRecommended = tier.recommended;
        return (
          <li
            key={tier.id}
            aria-label={`${tier.name} plan${isRecommended ? ' — recommended' : ''}${isCurrent ? ' — current plan' : ''}`}
            className={`flex flex-col gap-3 rounded-lg border bg-surface p-5 shadow-sm ${
              isCurrent ? 'border-success' : isRecommended ? 'border-accent' : 'border-border'
            }`}
            data-testid={`pricing-tier-${tier.id}`}
            data-current={isCurrent ? 'true' : undefined}
            data-recommended={isRecommended ? 'true' : undefined}
          >
            <header className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierBadgeClass(isRecommended, isCurrent)}`}
              >
                {isCurrent ? 'Current plan' : isRecommended ? 'Recommended' : ''}
              </span>
            </header>
            <p className="text-2xl font-bold">{tier.priceLabel}</p>
            <p className="text-sm text-fg-muted">{tier.tagline}</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {tier.highlights.map((line) => (
                <li key={line} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-3">
              <button
                type="button"
                onClick={() => onSelect?.(tier.id)}
                disabled={isCurrent}
                className={`inline-flex h-9 w-full items-center justify-center rounded-md px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed ${
                  isCurrent
                    ? 'bg-accent-soft text-fg-muted'
                    : isRecommended
                      ? 'bg-accent text-bg hover:bg-accent/90'
                      : 'border border-border bg-bg text-fg hover:bg-accent-soft'
                }`}
                data-testid={`pricing-tier-${tier.id}-cta`}
              >
                {isCurrent
                  ? 'Current plan'
                  : tier.id === 'enterprise'
                    ? 'Talk to sales'
                    : tier.id === 'free'
                      ? 'Start for free'
                      : 'Upgrade'}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
