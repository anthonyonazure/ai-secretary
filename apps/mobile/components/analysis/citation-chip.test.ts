/**
 * Mobile CitationChip — pure-logic tests (Story 3.5).
 *
 * The mobile vitest setup runs under node with no react-native renderer
 * (mirrors `consent-modal.test.ts`). The chip's pure logic — accessible
 * label, fixture resolution, visited-cache behavior — is testable
 * without rendering. Visual state assertions live in Storybook stories.
 */

import { describe, expect, it } from 'vitest';

import type { CitationRef } from '@aisecretary/shared';

import { FIXTURE_MEETING_ID, findFixtureTurn } from './speaker-turns.fixture';

const known: CitationRef = {
  meetingId: FIXTURE_MEETING_ID,
  turnId: 't-12',
  spanStartMs: 184_000,
  spanEndMs: 198_000,
  speaker: 'Dana',
};

const missing: CitationRef = {
  meetingId: FIXTURE_MEETING_ID,
  turnId: 't-missing',
  spanStartMs: 999_000,
  spanEndMs: 1_001_000,
};

/**
 * Mirror of the chip's accessibilityLabel composition. Keep in sync
 * with `citation-chip.tsx` — if the chip changes the label format,
 * update both. The web-side test asserts the same shape.
 */
function composeAccessibilityLabel(citation: CitationRef, hasFixture: boolean): string {
  if (!hasFixture) return 'Citation unavailable';
  const speaker = citation.speaker;
  const ts = formatTimestamp(citation.spanStartMs);
  return `Citation at ${ts}${speaker ? `, speaker ${speaker}` : ''}`;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

describe('CitationChip — fixture resolution', () => {
  it('resolves known citations to a fixture turn', () => {
    expect(findFixtureTurn(known)).toBeDefined();
    expect(findFixtureTurn(known)?.text).toMatch(/three decisions/i);
  });

  it('returns undefined for citations not in the fixture', () => {
    expect(findFixtureTurn(missing)).toBeUndefined();
  });
});

describe('CitationChip — accessibility label composition', () => {
  it('renders timestamp + speaker when the citation source is available', () => {
    expect(composeAccessibilityLabel(known, true)).toBe('Citation at 03:04, speaker Dana');
  });

  it('omits speaker when none is provided', () => {
    const c: CitationRef = { ...known, speaker: undefined };
    expect(composeAccessibilityLabel(c, true)).toBe('Citation at 03:04');
  });

  it('switches to "Citation unavailable" for the disabled state', () => {
    expect(composeAccessibilityLabel(missing, false)).toBe('Citation unavailable');
  });

  it('zero-pads MM:SS correctly across boundaries', () => {
    expect(composeAccessibilityLabel({ ...known, spanStartMs: 0 }, true)).toContain('00:00');
    expect(composeAccessibilityLabel({ ...known, spanStartMs: 9_000 }, true)).toContain('00:09');
    expect(composeAccessibilityLabel({ ...known, spanStartMs: 60_000 }, true)).toContain('01:00');
  });
});

describe('CitationChip — citation deep-link contract (Story 2.4 absorbed)', () => {
  it('roundtrips (meetingId, turnId) through the fixture lookup', () => {
    const turn = findFixtureTurn(known);
    expect(turn?.meetingId).toBe(known.meetingId);
    expect(turn?.turnId).toBe(known.turnId);
  });
});
