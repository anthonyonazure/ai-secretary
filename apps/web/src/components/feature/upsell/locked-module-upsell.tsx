/**
 * `LockedModuleUpsell` — Story 13.6 / FR64 / U11c.
 *
 * Renders when the entitlement-check plugin returns 403 with the
 * `upsell.module` extension. Tells the user which tier unlocks the
 * locked feature without nagging — UX spec § Step 5 anti-pattern #9
 * forbids "AI as feature, not substrate" + UX § Step 5 #2 forbids
 * "free-tier asterisk hell". This card is calm, plain-language, and
 * dismissible.
 *
 * Anti-pattern guarded against:
 *   - No interruption modals — this card is inline, replacing the
 *     locked surface
 *   - No countdown timers / scarcity pressure
 *   - No emoji urgency
 *   - The CTA links to a dedicated billing page; no in-card upgrade
 *     flow
 */

import type { BillingTierId } from '@aisecretary/shared';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

export interface LockedModuleUpsellProps {
  /** Module id (`'medical'`, `'sales'`, …) or feature flag (`'bot'`). */
  feature: string;
  /** Display label rendered to the user — "the medical module", "meeting bot", etc. */
  featureLabel: string;
  /** Minimum tier that unlocks the feature. */
  minimumTier: BillingTierId;
  /** Optional secondary description rendered below the headline. */
  description?: ReactNode;
  /** Called when the user clicks the upgrade CTA. */
  onUpgrade?: () => void;
  /** Called when the user dismisses the card. Omit to disable
   *  dismissal (used inline at locked-route boundaries). */
  onDismiss?: () => void;
}

const TIER_LABEL: Record<BillingTierId, string> = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
};

export function LockedModuleUpsell({
  feature,
  featureLabel,
  minimumTier,
  description,
  onUpgrade,
  onDismiss,
}: LockedModuleUpsellProps) {
  return (
    <article
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5"
      data-testid="locked-module-upsell"
      data-feature={feature}
      data-minimum-tier={minimumTier}
      aria-labelledby="locked-module-upsell-heading"
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-fg"
        >
          <Lock className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h3 id="locked-module-upsell-heading" className="text-base font-semibold">
            {featureLabel} is on <span className="text-accent">{TIER_LABEL[minimumTier]}</span>
          </h3>
          {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {onUpgrade ? (
          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-bg hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="locked-module-upgrade"
          >
            See {TIER_LABEL[minimumTier]} plans
          </button>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-9 items-center rounded-md border border-border bg-bg px-3 text-sm text-fg-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="locked-module-dismiss"
          >
            Not now
          </button>
        ) : null}
      </div>
    </article>
  );
}
