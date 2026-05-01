/**
 * Unit tests for the `computeTurnId` hash recipe — Story 3.5 (absorbing
 * Story 2.4). Pins the recipe so the transcription pipeline (Story 2.2)
 * and the analysis workers (Epic 4) compute identical IDs for the same
 * inputs.
 */

import { describe, expect, it } from 'vitest';
import { computeTurnId } from '../lib/speaker-turn-id.js';

const baseInput = {
  meetingId: '00000000-0000-0000-0000-00000000aaaa',
  sequence: 0,
  speaker: 'Dana' as string | null,
  spanStartMs: 12_400,
  text: 'We can ship this by Friday.',
};

describe('computeTurnId', () => {
  it('produces a 16-char lowercase hex string', () => {
    const id = computeTurnId(baseInput);
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for identical inputs', () => {
    const a = computeTurnId(baseInput);
    const b = computeTurnId(baseInput);
    expect(a).toBe(b);
  });

  it('differs when meetingId changes', () => {
    const a = computeTurnId(baseInput);
    const b = computeTurnId({ ...baseInput, meetingId: '00000000-0000-0000-0000-00000000bbbb' });
    expect(a).not.toBe(b);
  });

  it('differs when sequence changes', () => {
    const a = computeTurnId(baseInput);
    const b = computeTurnId({ ...baseInput, sequence: 1 });
    expect(a).not.toBe(b);
  });

  it('differs when speaker changes (including null vs string)', () => {
    const a = computeTurnId(baseInput);
    const b = computeTurnId({ ...baseInput, speaker: 'Sam' });
    const c = computeTurnId({ ...baseInput, speaker: null });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it('differs when spanStartMs changes', () => {
    const a = computeTurnId(baseInput);
    const b = computeTurnId({ ...baseInput, spanStartMs: 12_401 });
    expect(a).not.toBe(b);
  });

  it('differs when text changes', () => {
    const a = computeTurnId(baseInput);
    const b = computeTurnId({ ...baseInput, text: 'We can ship this by Friday!' });
    expect(a).not.toBe(b);
  });

  it('treats null speaker and empty-string speaker as identical (documented)', () => {
    // The recipe coalesces null → '' before hashing. This is an explicit
    // contract — if the transcription pipeline ever needs to distinguish
    // them, bump the hash version.
    const a = computeTurnId({ ...baseInput, speaker: null });
    const b = computeTurnId({ ...baseInput, speaker: '' });
    expect(a).toBe(b);
  });

  it('produces distinct IDs for 1000 distinct sequence values (collision smoke test)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      ids.add(computeTurnId({ ...baseInput, sequence: i }));
    }
    expect(ids.size).toBe(1000);
  });
});
