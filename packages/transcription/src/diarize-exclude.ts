/**
 * `diarize-exclude` — Story 9.5 substrate.
 *
 * Pure function that filters transcript segments by speaker label
 * against a set of "excluded" speakers. The bot orchestrator
 * (`apps/bot/src/zoom/consent-orchestrator.ts`) decides which speakers
 * to exclude based on the per-participant consent decision:
 *
 *   - `'accepted'`         → include normally
 *   - `'declined'`         → suppress all turns from this speaker
 *   - `'expired-no-response'` → suppress (60s window elapsed)
 *
 * Speakers without any consent row default to:
 *   - `legitimate-interest` policy → include (implicit ack)
 *   - `explicit-consent` policy    → suppress (default-deny)
 *
 * This module is the join point between `packages/consent` (which
 * decides the policy) and `packages/transcription` (which produces
 * the diarized turns). The transcribe handler invokes it after
 * `mergeDiarization()` so the persisted `speaker_turns` already lacks
 * suppressed speakers.
 */

import type { TranscriptionSegment } from './types.js';

export type ConsentDecision = 'accepted' | 'declined' | 'expired-no-response';

export interface ParticipantDecisions {
  /** Map: speaker label → decision. Speakers missing from the map use the fallback. */
  bySpeaker: Record<string, ConsentDecision>;
  /**
   * What to do when a segment's speaker isn't in `bySpeaker`. Drives
   * the EU vs non-EU default-deny vs default-allow split.
   */
  fallback: 'include' | 'suppress';
}

/**
 * Apply the participant-decision map to a segment list. Returns a new
 * array; never mutates the input.
 */
export const applyDiarizeExclude = (
  segments: readonly TranscriptionSegment[],
  decisions: ParticipantDecisions,
): TranscriptionSegment[] => {
  return segments.filter((seg) => {
    const speaker = seg.speaker;
    if (speaker === null) {
      // Untagged turn (silence buffer). Always include — it carries no
      // PII and excluding wouldn't help anyone.
      return true;
    }
    const decision = decisions.bySpeaker[speaker];
    if (!decision) {
      return decisions.fallback === 'include';
    }
    return decision === 'accepted';
  });
};

/**
 * Convenience builder — given the bot's per-participant consent rows
 * + the policy's legal basis, computes the decision map.
 */
export const buildParticipantDecisions = (
  rows: ReadonlyArray<{ speakerLabel: string; decision: ConsentDecision }>,
  legalBasis: 'legitimate-interest' | 'explicit-consent',
): ParticipantDecisions => {
  const bySpeaker: Record<string, ConsentDecision> = {};
  for (const row of rows) {
    bySpeaker[row.speakerLabel] = row.decision;
  }
  return {
    bySpeaker,
    fallback: legalBasis === 'explicit-consent' ? 'suppress' : 'include',
  };
};
