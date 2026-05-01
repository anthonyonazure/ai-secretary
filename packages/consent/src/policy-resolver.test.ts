import { describe, expect, it } from 'vitest';
import { resolveConsentLegalBasis } from './policy-resolver.js';

describe('resolveConsentLegalBasis (most-protective-rule-wins)', () => {
  it('alwaysExplicit override beats every other signal', () => {
    expect(
      resolveConsentLegalBasis({
        policy: { default: 'us', alwaysExplicit: true },
        participantRegions: ['us', 'us'],
      }),
    ).toBe('explicit-consent');
  });

  it('any EU participant escalates a US-default tenant to explicit-consent', () => {
    expect(
      resolveConsentLegalBasis({
        policy: { default: 'us' },
        participantRegions: ['us', 'eu', 'us'],
      }),
    ).toBe('explicit-consent');
  });

  it('EU-default tenant always lands at explicit-consent', () => {
    expect(
      resolveConsentLegalBasis({
        policy: { default: 'eu' },
        participantRegions: [],
      }),
    ).toBe('explicit-consent');

    expect(
      resolveConsentLegalBasis({
        policy: { default: 'eu' },
        participantRegions: ['us'],
      }),
    ).toBe('explicit-consent');
  });

  it('US-default tenant with all-US participants → legitimate-interest', () => {
    expect(
      resolveConsentLegalBasis({
        policy: { default: 'us' },
        participantRegions: ['us', 'us'],
      }),
    ).toBe('legitimate-interest');
  });

  it('US-default tenant with all-unknown participants → legitimate-interest', () => {
    // Per the ADR: unknown alone with US default does not promote;
    // promotion only fires when the tenant default itself is EU.
    expect(
      resolveConsentLegalBasis({
        policy: { default: 'us' },
        participantRegions: ['unknown'],
      }),
    ).toBe('legitimate-interest');
  });

  it('US-default tenant with no participants → legitimate-interest', () => {
    expect(
      resolveConsentLegalBasis({
        policy: { default: 'us' },
        participantRegions: [],
      }),
    ).toBe('legitimate-interest');
  });

  it('alwaysExplicit:false explicitly does NOT block escalation', () => {
    expect(
      resolveConsentLegalBasis({
        policy: { default: 'us', alwaysExplicit: false },
        participantRegions: ['eu'],
      }),
    ).toBe('explicit-consent');
  });
});
