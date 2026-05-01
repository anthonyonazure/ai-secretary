/**
 * Static four-tier billing configuration — Story 13.4.
 *
 * Source-of-truth for the marketing pricing page + the in-app
 * comparison table. Stripe price IDs are NOT in this file — they're
 * configured per-deployment via env so the same tier shape works for
 * dev / staging / prod.
 */

import type { BillingTierDescriptor } from '../schemas/billing.js';

export const BILLING_TIERS: ReadonlyArray<BillingTierDescriptor> = [
  {
    id: 'free',
    name: 'Free',
    priceLabel: '$0',
    tagline: 'Try the receipt — see if it sticks.',
    highlights: [
      '5 hours of meeting capture per month',
      'General module + transcript + summary',
      'Single user',
      'No card required',
    ],
    seatCeiling: 1,
    hoursIncluded: 5,
    enabledModuleIds: ['general'],
    recommended: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '$24 / seat / mo',
    tagline: 'For solo practitioners and small teams.',
    highlights: [
      '40 hours / seat / month',
      'All 8 vertical analysis modules',
      'RAG chat + cmd-K search',
      'Cross-org sharing + token URLs',
      'Email + push notifications',
    ],
    seatCeiling: 25,
    hoursIncluded: 40,
    enabledModuleIds: ['general', 'sales', 'hr', 'education', 'support', 'pm', 'psychology'],
    recommended: true,
  },
  {
    id: 'business',
    name: 'Business',
    priceLabel: '$48 / seat / mo',
    tagline: 'For organizations with admin + compliance needs.',
    highlights: [
      '100 hours / seat / month',
      'All Pro features',
      'Medical module (HIPAA-eligible routing)',
      'SSO (Google + Microsoft)',
      'F2-admin onboarding + audit-log export',
      'Priority support',
    ],
    seatCeiling: 250,
    hoursIncluded: 100,
    enabledModuleIds: [
      'general',
      'sales',
      'hr',
      'education',
      'medical',
      'support',
      'pm',
      'psychology',
    ],
    recommended: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Talk to sales',
    tagline: 'For regulated industries + customer-managed cloud.',
    highlights: [
      'Unlimited hours',
      'Customer-managed cloud + on-prem',
      'BAA + EU residency',
      'Custom-managed KMS',
      'SAML SSO + SCIM',
      'Custom DPA + dedicated CSM',
    ],
    seatCeiling: null,
    hoursIncluded: 100_000,
    enabledModuleIds: [
      'general',
      'sales',
      'hr',
      'education',
      'medical',
      'support',
      'pm',
      'psychology',
    ],
    recommended: false,
  },
];
