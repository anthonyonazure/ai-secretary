/**
 * Story 8.1 — clip-share bounds validation.
 *
 * A clip share grants access to a *bounded span* of a meeting recording
 * (`clipStartMs`..`clipEndMs`). The receiving surface, the API write
 * path, and the share-create form all need the same min/max/overlap
 * checks. This pure helper is the single owner.
 *
 * Constraints (UX spec § share clip):
 *   - Minimum length: 5 seconds (otherwise it's just a citation chip).
 *   - Maximum length: 10 minutes (longer = share the whole meeting).
 *   - Bounds must be inside the recording length.
 *   - End strictly greater than start.
 */

export interface ClipBoundsInput {
  startMs: number;
  endMs: number;
  recordingDurationMs: number;
}

export type ClipBoundsViolation =
  | 'start-negative'
  | 'end-before-start'
  | 'too-short'
  | 'too-long'
  | 'past-recording-end';

export interface ClipBoundsResult {
  ok: boolean;
  violations: ReadonlyArray<ClipBoundsViolation>;
  durationMs: number;
}

export const MIN_CLIP_DURATION_MS = 5 * 1000;
export const MAX_CLIP_DURATION_MS = 10 * 60 * 1000;

export const validateClipBounds = (input: ClipBoundsInput): ClipBoundsResult => {
  const violations: ClipBoundsViolation[] = [];
  if (input.startMs < 0) violations.push('start-negative');
  if (input.endMs <= input.startMs) violations.push('end-before-start');
  const durationMs = Math.max(0, input.endMs - input.startMs);
  if (durationMs > 0 && durationMs < MIN_CLIP_DURATION_MS) violations.push('too-short');
  if (durationMs > MAX_CLIP_DURATION_MS) violations.push('too-long');
  if (input.endMs > input.recordingDurationMs) violations.push('past-recording-end');
  return {
    ok: violations.length === 0,
    violations,
    durationMs,
  };
};

export const clampClipBounds = (input: ClipBoundsInput): ClipBoundsInput => {
  const cappedDuration = Math.max(0, input.recordingDurationMs);
  const rawStart = Math.max(0, Math.min(input.startMs, cappedDuration));
  const rawEnd = Math.max(rawStart + MIN_CLIP_DURATION_MS, Math.min(input.endMs, cappedDuration));
  if (rawEnd <= cappedDuration) {
    return { startMs: rawStart, endMs: rawEnd, recordingDurationMs: cappedDuration };
  }
  const endMs = cappedDuration;
  const startMs = Math.max(0, endMs - MIN_CLIP_DURATION_MS);
  return { startMs, endMs, recordingDurationMs: cappedDuration };
};
