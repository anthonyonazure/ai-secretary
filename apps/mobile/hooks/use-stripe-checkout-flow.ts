/**
 * `deriveCheckoutFlow` — Story 13.6 Stripe Checkout flow state.
 *
 * The mobile + web upgrade flow opens an external Stripe Checkout
 * session. The host owns the network call to `POST /api/v1/billing/
 * checkout-session`; this helper derives the in-app UX state — disabled
 * while session is being created, redirecting to checkout, awaiting
 * webhook confirmation, etc.
 */

export type CheckoutTier = 'pro' | 'business' | 'enterprise';

export type CheckoutFlowInput = {
  selectedTier: CheckoutTier | null;
  isCreatingSession: boolean;
  isAwaitingWebhook: boolean;
  webhookConfirmedAt: string | null;
  webhookExpectedBy: string | null;
  errorKind: 'card-declined' | 'authorization-required' | 'network' | null;
  now?: number;
};

export type CheckoutFlowResult = {
  primaryButton:
    | { kind: 'select-tier'; disabled: true }
    | { kind: 'create-session'; disabled: boolean; copy: string }
    | { kind: 'awaiting'; disabled: true; copy: string }
    | { kind: 'success'; disabled: true; copy: string }
    | { kind: 'retry'; disabled: false; copy: string };
  errorBanner: string | null;
  showSpinner: boolean;
};

const ERROR_COPY: Record<NonNullable<CheckoutFlowInput['errorKind']>, string> = {
  'card-declined': 'Your card was declined. Try a different one.',
  'authorization-required': 'Your bank wants to verify the charge. Try again to confirm.',
  network: 'Network hiccup — try again in a moment.',
};

export const deriveCheckoutFlow = (input: CheckoutFlowInput): CheckoutFlowResult => {
  const now = input.now ?? Date.now();

  if (input.errorKind !== null) {
    return {
      primaryButton: {
        kind: 'retry',
        disabled: false,
        copy: 'Try again',
      },
      errorBanner: ERROR_COPY[input.errorKind],
      showSpinner: false,
    };
  }

  if (input.webhookConfirmedAt !== null) {
    return {
      primaryButton: { kind: 'success', disabled: true, copy: 'Welcome aboard' },
      errorBanner: null,
      showSpinner: false,
    };
  }

  if (input.isAwaitingWebhook) {
    const expected = input.webhookExpectedBy !== null ? Date.parse(input.webhookExpectedBy) : null;
    const overdue = expected !== null && now > expected;
    return {
      primaryButton: {
        kind: 'awaiting',
        disabled: true,
        copy: overdue ? 'Almost there…' : 'Confirming with Stripe…',
      },
      errorBanner: overdue
        ? 'This is taking longer than usual. Refresh after a minute if it doesn’t advance.'
        : null,
      showSpinner: true,
    };
  }

  if (input.isCreatingSession) {
    return {
      primaryButton: { kind: 'awaiting', disabled: true, copy: 'Opening checkout…' },
      errorBanner: null,
      showSpinner: true,
    };
  }

  if (input.selectedTier === null) {
    return {
      primaryButton: { kind: 'select-tier', disabled: true },
      errorBanner: null,
      showSpinner: false,
    };
  }

  return {
    primaryButton: {
      kind: 'create-session',
      disabled: false,
      copy: `Continue to ${input.selectedTier}`,
    },
    errorBanner: null,
    showSpinner: false,
  };
};
