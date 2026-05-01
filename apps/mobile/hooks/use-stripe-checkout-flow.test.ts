import { describe, expect, it } from 'vitest';

import { deriveCheckoutFlow } from './use-stripe-checkout-flow.js';

const baseInput = {
  selectedTier: null,
  isCreatingSession: false,
  isAwaitingWebhook: false,
  webhookConfirmedAt: null,
  webhookExpectedBy: null,
  errorKind: null,
};

describe('deriveCheckoutFlow', () => {
  it('disables the primary button until a tier is selected', () => {
    const r = deriveCheckoutFlow(baseInput);
    expect(r.primaryButton.kind).toBe('select-tier');
    expect(r.primaryButton.disabled).toBe(true);
  });

  it('enables the create-session button once a tier is picked', () => {
    const r = deriveCheckoutFlow({ ...baseInput, selectedTier: 'pro' });
    expect(r.primaryButton.kind).toBe('create-session');
    if (r.primaryButton.kind === 'create-session') {
      expect(r.primaryButton.copy).toMatch(/Continue to pro/);
    }
  });

  it('shows a spinner while the checkout session is being created', () => {
    const r = deriveCheckoutFlow({
      ...baseInput,
      selectedTier: 'pro',
      isCreatingSession: true,
    });
    expect(r.showSpinner).toBe(true);
    if (r.primaryButton.kind === 'awaiting') {
      expect(r.primaryButton.copy).toMatch(/Opening checkout/);
    }
  });

  it('shows the awaiting state while waiting for webhook', () => {
    const now = 1_700_000_000_000;
    const r = deriveCheckoutFlow({
      ...baseInput,
      selectedTier: 'pro',
      isAwaitingWebhook: true,
      webhookExpectedBy: new Date(now + 30_000).toISOString(),
      now,
    });
    expect(r.primaryButton.kind).toBe('awaiting');
    expect(r.errorBanner).toBeNull();
  });

  it('emits an "almost there" banner when webhook is overdue', () => {
    const now = 1_700_000_000_000;
    const r = deriveCheckoutFlow({
      ...baseInput,
      selectedTier: 'pro',
      isAwaitingWebhook: true,
      webhookExpectedBy: new Date(now - 10_000).toISOString(),
      now,
    });
    expect(r.errorBanner).toMatch(/longer than usual/);
  });

  it('shows success once the webhook lands', () => {
    const r = deriveCheckoutFlow({
      ...baseInput,
      selectedTier: 'pro',
      webhookConfirmedAt: '2026-04-30T12:00:00Z',
    });
    expect(r.primaryButton.kind).toBe('success');
  });

  it('routes a card-declined error to the retry state', () => {
    const r = deriveCheckoutFlow({
      ...baseInput,
      selectedTier: 'pro',
      errorKind: 'card-declined',
    });
    expect(r.primaryButton.kind).toBe('retry');
    expect(r.errorBanner).toMatch(/declined/);
  });

  it('routes auth-required to the retry state with bank-verify copy', () => {
    const r = deriveCheckoutFlow({
      ...baseInput,
      selectedTier: 'pro',
      errorKind: 'authorization-required',
    });
    expect(r.errorBanner).toMatch(/verify/);
  });
});
