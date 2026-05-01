/**
 * Stable speaker-turn ID hashing — Story 2.4 (absorbed into Story 3.5).
 *
 * The citation deep-link contract is `(meetingId, turnId)` per
 * `_bmad-output/planning-artifacts/reconciliation-note.md` N5 and the
 * `citationRefSchema` in `packages/shared/src/schemas/module-output.ts`.
 * `turn_id` is NOT the row UUID — it is a stable, deterministic hash
 * derived from the inputs below so that:
 *
 *   1. Citations emitted by analysis workers are stable across re-runs
 *      that produce the same turn boundaries + text.
 *   2. The transcription pipeline (Story 2.2) can compute the same
 *      `turn_id` for a given diarized turn without round-tripping the
 *      database.
 *   3. Two different turns within the same meeting produce different
 *      IDs with overwhelming probability (sha256 truncated to 16 hex
 *      chars = 64 bits, well below collision risk for any single
 *      meeting).
 *
 * Stability commitment:
 *   - Once a `speaker_turns` row is written with a given `turn_id`, that
 *     `turn_id` is never mutated. Subsequent re-transcriptions that
 *     change boundaries write NEW rows with NEW `turn_id`s; the old
 *     rows are left in place (or soft-deleted by future stories) so
 *     existing citations keep resolving.
 *   - Adding fields to the hash recipe is a breaking change — bump a
 *     hash version constant and migrate.
 *
 * Recipe:
 *   sha256(`${meetingId}|${sequence}|${speaker ?? ''}|${spanStartMs}|${text}`)
 *     .slice(0, 16)   // 16 hex chars = 64 bits
 *
 * Pure node-stdlib implementation — no provider SDK, no DB call.
 */

import { createHash } from 'node:crypto';

export interface ComputeTurnIdInput {
  meetingId: string;
  sequence: number;
  speaker: string | null;
  spanStartMs: number;
  text: string;
}

const HASH_LENGTH_HEX = 16;

/**
 * Compute the stable 16-char hex `turn_id` for a speaker turn.
 *
 * The transcription pipeline writes rows with this ID; analysis workers
 * cite the same ID in `citationRefSchema.turnId`; the web/mobile
 * `CitationChip` deep-links via `(meetingId, turnId)`.
 */
export function computeTurnId(input: ComputeTurnIdInput): string {
  const { meetingId, sequence, speaker, spanStartMs, text } = input;
  const payload = `${meetingId}|${sequence}|${speaker ?? ''}|${spanStartMs}|${text}`;
  return createHash('sha256').update(payload).digest('hex').slice(0, HASH_LENGTH_HEX);
}
