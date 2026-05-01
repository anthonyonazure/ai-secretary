import { describe, expect, it } from 'vitest';
import { type TenantLlmContext, selectProviderKindForTenant } from './selector.js';

const ctx = (overrides: Partial<TenantLlmContext>): TenantLlmContext => ({
  region: 'us',
  compliancePosture: {},
  ...overrides,
});

describe('selectProviderKindForTenant', () => {
  it('routes default US non-regulated tenants to anthropic with openai fallback', () => {
    const result = selectProviderKindForTenant(ctx({ region: 'us' }));
    expect(result).toEqual({ primary: 'anthropic', fallbacks: ['openai'] });
  });

  it('routes HIPAA tenants to bedrock with azure-openai fallback', () => {
    const result = selectProviderKindForTenant(
      ctx({ region: 'us', compliancePosture: { hipaa: true } }),
    );
    expect(result).toEqual({ primary: 'bedrock', fallbacks: ['azure-openai'] });
  });

  it('routes EU non-HIPAA tenants to bedrock with azure-openai fallback', () => {
    const result = selectProviderKindForTenant(ctx({ region: 'eu' }));
    expect(result).toEqual({ primary: 'bedrock', fallbacks: ['azure-openai'] });
  });

  it('routes EU HIPAA tenants to bedrock (HIPAA + EU both compatible)', () => {
    const result = selectProviderKindForTenant(
      ctx({ region: 'eu', compliancePosture: { hipaa: true } }),
    );
    expect(result.primary).toBe('bedrock');
    // Bedrock satisfies both HIPAA + EU; Azure OpenAI is the fallback.
    expect(result.fallbacks).toEqual(['azure-openai']);
  });

  it('routes BYOK tenants (US) to bedrock with azure-openai fallback', () => {
    const result = selectProviderKindForTenant(
      ctx({ region: 'us', compliancePosture: { customManagedKeys: true } }),
    );
    expect(result).toEqual({ primary: 'bedrock', fallbacks: ['azure-openai'] });
  });

  it('respects allowlist override that excludes the default', () => {
    const result = selectProviderKindForTenant(
      ctx({
        region: 'us',
        compliancePosture: { allowedLlmProviders: ['ollama', 'openai'] },
      }),
    );
    expect(result).toEqual({ primary: 'ollama', fallbacks: ['openai'] });
  });

  it('respects allowlist order', () => {
    const result = selectProviderKindForTenant(
      ctx({
        region: 'us',
        compliancePosture: { allowedLlmProviders: ['openai', 'anthropic'] },
      }),
    );
    expect(result).toEqual({ primary: 'openai', fallbacks: ['anthropic'] });
  });

  it('filters allowlist entries that violate region constraints (EU drops anthropic + openai)', () => {
    const result = selectProviderKindForTenant(
      ctx({
        region: 'eu',
        compliancePosture: { allowedLlmProviders: ['anthropic', 'openai', 'bedrock'] },
      }),
    );
    expect(result).toEqual({ primary: 'bedrock', fallbacks: [] });
  });

  it('filters allowlist entries that violate HIPAA constraints', () => {
    const result = selectProviderKindForTenant(
      ctx({
        region: 'us',
        compliancePosture: {
          hipaa: true,
          allowedLlmProviders: ['anthropic', 'openai', 'bedrock'],
        },
      }),
    );
    expect(result).toEqual({ primary: 'bedrock', fallbacks: [] });
  });

  it('falls back to default rules if allowlist is fully incompatible (defensive)', () => {
    // EU tenant allowlists ONLY direct anthropic + openai → both filtered.
    const result = selectProviderKindForTenant(
      ctx({
        region: 'eu',
        compliancePosture: { allowedLlmProviders: ['anthropic', 'openai'] },
      }),
    );
    // Should fall back to the EU default chain rather than hard-fail.
    expect(result).toEqual({ primary: 'bedrock', fallbacks: ['azure-openai'] });
  });

  it('dedupes repeated allowlist entries', () => {
    const result = selectProviderKindForTenant(
      ctx({
        region: 'us',
        compliancePosture: { allowedLlmProviders: ['anthropic', 'anthropic', 'openai'] },
      }),
    );
    expect(result).toEqual({ primary: 'anthropic', fallbacks: ['openai'] });
  });

  it('never returns mock as a kind', () => {
    // Sanity check — there's no path through the selector that yields 'mock'.
    const cases: TenantLlmContext[] = [
      ctx({ region: 'us' }),
      ctx({ region: 'eu' }),
      ctx({ region: 'us', compliancePosture: { hipaa: true } }),
      ctx({ region: 'us', compliancePosture: { customManagedKeys: true } }),
    ];
    for (const c of cases) {
      const r = selectProviderKindForTenant(c);
      expect(r.primary).not.toBe('mock');
      expect(r.fallbacks).not.toContain('mock');
    }
  });
});
