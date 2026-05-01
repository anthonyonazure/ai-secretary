import type { LlmProviderKind } from './types.js';

/**
 * Per-tenant LLM provider routing — encodes the compliance-posture rules
 * from CLAUDE.md (§ "Compliance posture routing") and architecture.md
 * § "AI Layer / Per-tenant compliance posture routing":
 *
 *   - HIPAA / behavioral-health tenants → Anthropic via AWS Bedrock
 *     (BAA included), then Azure OpenAI (HIPAA-eligible) as fallback.
 *     The direct Anthropic API has no BAA at most tiers; the direct
 *     OpenAI API explicitly excludes itself from HIPAA workloads.
 *   - EU tenants → Anthropic via AWS Bedrock (eu-west-1 region) primary;
 *     Azure OpenAI EU as fallback. Direct Anthropic / OpenAI APIs egress
 *     EU and are excluded from the preference list.
 *   - Custom-managed-keys tenants → Bedrock or Azure OpenAI (both
 *     support BYOK / customer CMKs).
 *   - `allowedLlmProviders` override → respect explicit allowlist; first
 *     entry that's also compatible with region wins, all other entries
 *     follow as fallbacks in order.
 *   - Otherwise → Anthropic direct (default for non-regulated US tenants),
 *     OpenAI as fallback.
 *
 * Returns an ordered preference list — primary first, fallbacks in
 * order. The gateway calls each in sequence on retryable errors when
 * `enableFallback: true`.
 *
 * The selector NEVER returns `mock` — that's a test-time injection only,
 * achieved by handing a `MockLlmProvider` to the gateway directly.
 */

export interface TenantLlmContext {
  region: 'us' | 'eu';
  compliancePosture: {
    hipaa?: boolean;
    bookGdpr?: boolean;
    customManagedKeys?: boolean;
    /**
     * Optional explicit allowlist. When present, only listed providers
     * are considered (in the order given). Region + HIPAA constraints
     * still filter — e.g. an EU tenant that allowlists `openai` will
     * skip `openai` because the direct OpenAI API egresses EU.
     */
    allowedLlmProviders?: ReadonlyArray<
      'anthropic' | 'openai' | 'azure-openai' | 'bedrock' | 'ollama'
    >;
  };
}

export interface ProviderPreference {
  primary: LlmProviderKind;
  /** Ordered list of fallback kinds — empty when no fallback is appropriate. */
  fallbacks: LlmProviderKind[];
}

/**
 * Providers that satisfy HIPAA when configured against their HIPAA-
 * eligible deployment (Bedrock BAA, Azure OpenAI HIPAA tier).
 * Direct `anthropic` and `openai` are excluded — neither has a BAA at
 * the standard API tier.
 */
const HIPAA_ELIGIBLE: ReadonlySet<LlmProviderKind> = new Set(['bedrock', 'azure-openai', 'ollama']);

/**
 * Providers that keep traffic inside the EU when configured against
 * their EU region (Bedrock eu-west-1, Azure OpenAI EU resource,
 * self-hosted Ollama). Direct `anthropic` / `openai` egress to US.
 */
const EU_COMPATIBLE: ReadonlySet<LlmProviderKind> = new Set(['bedrock', 'azure-openai', 'ollama']);

const ALL_NON_MOCK_KINDS: ReadonlyArray<LlmProviderKind> = [
  'anthropic',
  'openai',
  'azure-openai',
  'bedrock',
  'ollama',
];

const isCompatibleWithContext = (kind: LlmProviderKind, ctx: TenantLlmContext): boolean => {
  if (kind === 'mock') return false;
  if (ctx.compliancePosture.hipaa === true && !HIPAA_ELIGIBLE.has(kind)) return false;
  if (ctx.region === 'eu' && !EU_COMPATIBLE.has(kind)) return false;
  return true;
};

const dedupe = (kinds: LlmProviderKind[]): LlmProviderKind[] => {
  const seen = new Set<LlmProviderKind>();
  const out: LlmProviderKind[] = [];
  for (const k of kinds) {
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
};

const splitPreference = (kinds: LlmProviderKind[]): ProviderPreference => {
  const [primary, ...rest] = kinds;
  if (primary === undefined) {
    // Defensive: every code path below seeds at least one entry. If we
    // ever hit this it's a bug; surface a no-op default that the
    // gateway will flag as "no provider available" through the factory.
    return { primary: 'anthropic', fallbacks: [] };
  }
  return { primary, fallbacks: rest };
};

export function selectProviderKindForTenant(ctx: TenantLlmContext): ProviderPreference {
  // 1. Explicit allowlist override — respect order, drop incompatible kinds.
  const allow = ctx.compliancePosture.allowedLlmProviders;
  if (allow !== undefined && allow.length > 0) {
    const filtered = allow.filter((k) => isCompatibleWithContext(k, ctx));
    if (filtered.length > 0) return splitPreference(dedupe(filtered));
    // Fallback to default rules if the allowlist is fully incompatible
    // — better to route somewhere safe than to hard-fail.
  }

  // 2. HIPAA — Bedrock primary, Azure OpenAI fallback.
  if (ctx.compliancePosture.hipaa === true) {
    return splitPreference(['bedrock', 'azure-openai']);
  }

  // 3. EU — Bedrock (eu-west-1) primary, Azure OpenAI EU fallback.
  if (ctx.region === 'eu') {
    return splitPreference(['bedrock', 'azure-openai']);
  }

  // 4. Customer-managed keys — Bedrock or Azure OpenAI (both BYOK).
  if (ctx.compliancePosture.customManagedKeys === true) {
    return splitPreference(['bedrock', 'azure-openai']);
  }

  // 5. Default non-regulated US tenant — Anthropic direct, OpenAI fallback.
  return splitPreference(['anthropic', 'openai']);
}

/** Internal helper for tests + diagnostics — exposed via package index. */
export const _internal = {
  HIPAA_ELIGIBLE,
  EU_COMPATIBLE,
  ALL_NON_MOCK_KINDS,
};
