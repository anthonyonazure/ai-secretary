/**
 * Resolves the consent legal basis for a meeting, applying the
 * "most-protective applicable rule wins" principle from
 * arch-addendums § 7 + ADR-0005.
 *
 *   1. Org `alwaysExplicit` toggle → 'explicit-consent' (terminal).
 *   2. ANY participant region resolved as 'eu' → 'explicit-consent'.
 *   3. Tenant default region 'eu' → 'explicit-consent'.
 *   4. Any participant 'unknown' AND tenant default 'eu' → 'explicit-consent'.
 *      (Defensive promotion — better to over-protect than leak.)
 *   5. Otherwise → 'legitimate-interest'.
 */

import type { ConsentLegalBasis, ConsentPolicy, ParticipantRegion } from './types.js';

export interface PolicyInput {
  policy: ConsentPolicy;
  participantRegions: ReadonlyArray<ParticipantRegion>;
}

export function resolveConsentLegalBasis({
  policy,
  participantRegions,
}: PolicyInput): ConsentLegalBasis {
  // 1. Org override always wins.
  if (policy.alwaysExplicit === true) {
    return 'explicit-consent';
  }

  // 2. Any explicit EU participant.
  if (participantRegions.includes('eu')) {
    return 'explicit-consent';
  }

  // 3. Tenant default is EU — covers both the empty-participant case and
  //    the "unknown participant + EU default" defensive-promotion clause
  //    from arch-addendums § 7 (since tenant default is the same signal
  //    in both situations, a single check captures both).
  if (policy.default === 'eu') {
    return 'explicit-consent';
  }

  // 4. Default — implicit acknowledgment with opt-out path.
  //    US-default tenant with unknown-only participants stays here per
  //    ADR-0005: promotion only fires when a stronger signal (explicit
  //    EU participant or EU tenant default) is present.
  return 'legitimate-interest';
}
