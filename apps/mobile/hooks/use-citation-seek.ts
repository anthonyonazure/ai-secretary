/**
 * `useCitationSeek` — pure helper that resolves a `(meetingId, turnId)`
 * citation into a seek target with the locked 5-second pre-roll
 * (UX spec FR78).
 *
 * The native `TranscriptSeekPlayer` consumes this to position the
 * audio playhead before pressing play, so the user lands ~5s before
 * the cited claim.
 */

import type { CitationRef } from '@aisecretary/shared';

const PRE_ROLL_MS = 5_000;

export interface CitationSeekResult {
  /** Position the player should seek to before playing. */
  seekToMs: number;
  /** Span the highlighted UI region uses. */
  highlightStartMs: number;
  highlightEndMs: number;
  /** Speaker label rendered in the chip's tooltip; null when undiarized. */
  speaker: string | null;
}

export const computeCitationSeek = (citation: CitationRef): CitationSeekResult => {
  const seekToMs = Math.max(0, citation.spanStartMs - PRE_ROLL_MS);
  return {
    seekToMs,
    highlightStartMs: citation.spanStartMs,
    highlightEndMs: citation.spanEndMs,
    speaker: citation.speaker ?? null,
  };
};

/**
 * Format a span start as `MM:SS` for chip labels.
 */
export const formatCitationStamp = (spanStartMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(spanStartMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Build the full ARIA label for a `CitationChip`.
 * Format: "Citation at MM:SS, speaker {name}"
 */
export const buildCitationAriaLabel = (citation: CitationRef): string => {
  const stamp = formatCitationStamp(citation.spanStartMs);
  const speaker = citation.speaker ?? 'unidentified';
  return `Citation at ${stamp}, speaker ${speaker}`;
};
