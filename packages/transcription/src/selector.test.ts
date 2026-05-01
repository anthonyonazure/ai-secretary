import { describe, expect, it } from 'vitest';
import { selectProviderKindForTenant } from './selector.js';

describe('selectProviderKindForTenant', () => {
  it('routes US non-HIPAA non-BYOK tenants to whisper-api', () => {
    expect(
      selectProviderKindForTenant({
        region: 'us',
        compliancePosture: {},
      }),
    ).toBe('whisper-api');
  });

  it('routes US HIPAA tenants to faster-whisper (no OpenAI BAA)', () => {
    expect(
      selectProviderKindForTenant({
        region: 'us',
        compliancePosture: { hipaa: true },
      }),
    ).toBe('faster-whisper');
  });

  it('routes EU tenants to faster-whisper (data residency)', () => {
    expect(
      selectProviderKindForTenant({
        region: 'eu',
        compliancePosture: {},
      }),
    ).toBe('faster-whisper');
  });

  it('routes EU HIPAA tenants to faster-whisper (HIPAA precedence)', () => {
    // Both rules trip; HIPAA hits first per precedence.
    expect(
      selectProviderKindForTenant({
        region: 'eu',
        compliancePosture: { hipaa: true },
      }),
    ).toBe('faster-whisper');
  });

  it('routes US BYOK (custom-managed-keys) tenants to faster-whisper', () => {
    expect(
      selectProviderKindForTenant({
        region: 'us',
        compliancePosture: { customManagedKeys: true },
      }),
    ).toBe('faster-whisper');
  });

  it('does NOT route to faster-whisper purely on bookGdpr — region-pinning handles GDPR', () => {
    // bookGdpr is an org/contract flag; it doesn't change engine choice
    // by itself. EU tenants get faster-whisper because of `region`,
    // not because of `bookGdpr`.
    expect(
      selectProviderKindForTenant({
        region: 'us',
        compliancePosture: { bookGdpr: true },
      }),
    ).toBe('whisper-api');
  });

  it('treats hipaa: false explicitly the same as undefined', () => {
    expect(
      selectProviderKindForTenant({
        region: 'us',
        compliancePosture: { hipaa: false },
      }),
    ).toBe('whisper-api');
  });
});
