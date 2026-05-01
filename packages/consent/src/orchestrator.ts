/**
 * ConsentOrchestrator — sequences the consent surfaces a recording
 * needs before it can lawfully proceed.
 *
 * Story 4.3 covers shape A (always for the recording user) + shape C
 * (in-person QR/URL when org config flags it). The EU explicit branch
 * surfaces additional copy + a per-participant exclusion contract;
 * Story 9.5 wires bot-side per-participant exclusion downstream.
 *
 * Pure function — no I/O. The recording controller / bot orchestrator
 * passes in meeting context + policy snapshots; the orchestrator
 * returns an ordered `ConsentSurface[]`.
 */

import { resolveConsentLegalBasis } from './policy-resolver.js';
import { detectParticipantRegion } from './region-detect.js';
import type {
  ConsentParticipantInput,
  ConsentPolicy,
  ConsentSurface,
  MeetingSource,
  ParticipantRegion,
} from './types.js';

export interface SurfacesForInput {
  meetingSource: MeetingSource;
  tenantPolicy: ConsentPolicy;
  participants: ReadonlyArray<ConsentParticipantInput>;
}

/**
 * Returns the ordered list of consent surfaces required for this
 * meeting.
 *
 * Sequencing rule:
 *   1. Shape A — always first for the recording user.
 *   2. EU explicit branch — appended directly after shape A when
 *      legalBasis === 'explicit-consent'. (Same UI surface; renderer
 *      reads the flag and shows the additional checkbox.)
 *   3. Shape C — appended when org policy requires in-person
 *      consent AND meetingSource is mobile/web mic.
 */
export function surfacesFor(input: SurfacesForInput): ConsentSurface[] {
  const participantRegions = input.participants.map<{
    participantId: string;
    region: ParticipantRegion;
  }>((p, idx) => ({
    participantId: p.id ?? `p-${idx}`,
    region: detectParticipantRegion({
      ...(p.email !== undefined ? { email: p.email } : {}),
      ...(p.calendarTimezone !== undefined ? { calendarTimezone: p.calendarTimezone } : {}),
      ...(p.ipCountry !== undefined ? { ipCountry: p.ipCountry } : {}),
    }),
  }));

  const legalBasis = resolveConsentLegalBasis({
    policy: input.tenantPolicy,
    participantRegions: participantRegions.map((p) => p.region),
  });

  const surfaces: ConsentSurface[] = [];

  // 1. Shape A — pre-mic modal for the recording user. Always required.
  surfaces.push({
    shape: 'A',
    legalBasis,
    audience: 'recording-user',
  });

  // 2. EU explicit branch — appended as its own surface so the renderer
  //    can hang the per-participant explicit-acknowledgment language +
  //    the exclusion API contract off of it. Story 9.5 wires actual
  //    bot-side exclusion; Story 4.3 only exposes the contract.
  if (legalBasis === 'explicit-consent' && participantRegions.length > 0) {
    surfaces.push({
      shape: 'eu-explicit',
      legalBasis,
      audience: 'remote-participant',
      participantRegions,
    });
  }

  // 3. Shape C — in-person QR/URL surface. Only when:
  //    - org config has flagged in-person consent required, AND
  //    - meeting source is first-party capture (not bot, not upload).
  const isFirstPartyCapture =
    input.meetingSource === 'mobile-mic' || input.meetingSource === 'web-mic';
  if (input.tenantPolicy.orgInPersonRequired === true && isFirstPartyCapture) {
    surfaces.push({
      shape: 'C',
      legalBasis,
      audience: 'in-person-counterpart',
    });
  }

  return surfaces;
}

/**
 * Re-exposed under a class-name namespace so callers can write
 * `ConsentOrchestrator.surfacesFor(...)` per the spec wiring example.
 */
export const ConsentOrchestrator = {
  surfacesFor,
};
