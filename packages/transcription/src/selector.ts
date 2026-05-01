import type { TranscriptionEngineKind } from './types.js';

/**
 * Per-tenant transcription engine routing — the transcription
 * counterpart to the LLM-gateway compliance routing in CLAUDE.md
 * (§ "Compliance posture routing"):
 *
 *   - HIPAA / behavioral-health tenants → faster-whisper
 *     (self-hosted; the OpenAI Whisper API does not currently sign
 *     a HIPAA BAA, so audio + transcript must stay inside the tenant's
 *     compliant data plane).
 *   - EU tenants → faster-whisper (data residency: the audio + intermediate
 *     state must stay inside the eu-west region; routing to the OpenAI
 *     API endpoint would egress the region).
 *   - Custom-managed-keys tenants → faster-whisper (BYOK / customer-CMK
 *     can't be honored by Whisper API).
 *   - Everyone else → whisper-api (ZDR; cheaper + faster + good enough
 *     for non-regulated workloads).
 *
 * Precedence: HIPAA > EU > customMangedKeys > default. Each rule is
 * additive — once we hit a "use faster-whisper" reason we return; we
 * never demote a faster-whisper-required tenant back to whisper-api
 * just because a later reason wasn't tripped.
 */
export interface TenantTranscriptionContext {
  region: 'us' | 'eu';
  compliancePosture: {
    hipaa?: boolean;
    bookGdpr?: boolean;
    customManagedKeys?: boolean;
    allowedLlmProviders?: ReadonlyArray<string>;
  };
}

export function selectProviderKindForTenant(
  ctx: TenantTranscriptionContext,
): TranscriptionEngineKind {
  if (ctx.compliancePosture.hipaa === true) return 'faster-whisper';
  if (ctx.region === 'eu') return 'faster-whisper';
  if (ctx.compliancePosture.customManagedKeys === true) return 'faster-whisper';
  return 'whisper-api';
}
