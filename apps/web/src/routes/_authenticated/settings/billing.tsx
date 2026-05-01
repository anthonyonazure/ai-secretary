/**
 * `/settings/billing` — pricing + plan management surface.
 *
 * Story 13.4 / 13.5 substrate. Hosts the `PricingGrid` against the
 * static four-tier configuration. The "Current plan" highlight is
 * derived from the tenant's current plan once the entitlements
 * endpoint ships in Story 13.2; today the page falls through to
 * `free` so the layout is exercised end-to-end.
 *
 * Upgrade CTAs invoke `onSelect`. The host wires:
 *   - `pro` / `business` → Stripe checkout link (Story 13.1 follow-up)
 *   - `enterprise`        → contact-sales mailto / Calendly link
 *   - `free`              → noop (already free, button is disabled
 *                            on the user's current tier)
 *
 * F2-admin trial-state messaging will land alongside Stripe wiring.
 */

import type { BillingTierId } from '@aisecretary/shared';
import { createFileRoute } from '@tanstack/react-router';
import { CreditCard } from 'lucide-react';
import { useCallback } from 'react';

import { PricingGrid } from '../../../components/feature/billing/pricing-grid';

export const Route = createFileRoute('/_authenticated/settings/billing')({
  component: BillingRoute,
});

function BillingRoute() {
  const handleSelect = useCallback((tierId: BillingTierId) => {
    if (tierId === 'enterprise') {
      window.location.href = 'mailto:sales@aisecretary.app?subject=Enterprise%20pilot';
      return;
    }
    // Stripe-checkout link target — production wires the per-tier
    // price id once Story 13.1 ships the webhook endpoint.
    const url = `https://aisecretary.app/checkout/${tierId}`;
    window.location.href = url;
  }, []);

  // TODO(Story 13.2): read the current tier from the entitlements
  // query once the endpoint exists; default to 'free' for now.
  const currentTierId: BillingTierId = 'free';

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-fg"
        >
          <CreditCard className="h-4 w-4" aria-hidden="true" />
        </span>
        <h1 className="font-sans text-2xl font-semibold">Plans &amp; billing</h1>
      </header>

      <p className="text-sm text-fg-muted">
        Pick the plan that fits how you work. Cancel anytime — no contracts on Pro or Business.
      </p>

      <PricingGrid currentTierId={currentTierId} onSelect={handleSelect} />
    </section>
  );
}
