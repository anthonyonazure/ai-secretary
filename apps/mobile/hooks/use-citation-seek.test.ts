import type { CitationRef } from '@aisecretary/shared';
import { describe, expect, it } from 'vitest';

import {
  buildCitationAriaLabel,
  computeCitationSeek,
  formatCitationStamp,
} from './use-citation-seek.js';

const buildCitation = (overrides: Partial<CitationRef> = {}): CitationRef => ({
  meetingId: '11111111-1111-1111-1111-111111111111',
  turnId: 'turn-1',
  spanStartMs: 65_000,
  spanEndMs: 72_000,
  speaker: 'Anthony',
  ...overrides,
});

describe('computeCitationSeek', () => {
  it('subtracts the 5-second pre-roll', () => {
    const r = computeCitationSeek(buildCitation({ spanStartMs: 12_000 }));
    expect(r.seekToMs).toBe(7_000);
    expect(r.highlightStartMs).toBe(12_000);
  });

  it('clamps the seek target to 0', () => {
    const r = computeCitationSeek(buildCitation({ spanStartMs: 2_000 }));
    expect(r.seekToMs).toBe(0);
  });

  it('passes the speaker through (or null when undiarized)', () => {
    expect(computeCitationSeek(buildCitation({ speaker: 'Casey' })).speaker).toBe('Casey');
    expect(computeCitationSeek({ ...buildCitation(), speaker: undefined }).speaker).toBeNull();
  });
});

describe('formatCitationStamp', () => {
  it('renders MM:SS', () => {
    expect(formatCitationStamp(0)).toBe('0:00');
    expect(formatCitationStamp(65_000)).toBe('1:05');
    expect(formatCitationStamp(540_000)).toBe('9:00');
    expect(formatCitationStamp(3_605_000)).toBe('60:05');
  });

  it('clamps negative values to zero', () => {
    expect(formatCitationStamp(-1000)).toBe('0:00');
  });
});

describe('buildCitationAriaLabel', () => {
  it('combines stamp + speaker into a screen-reader-friendly label', () => {
    expect(buildCitationAriaLabel(buildCitation({ spanStartMs: 65_000, speaker: 'Anthony' }))).toBe(
      'Citation at 1:05, speaker Anthony',
    );
  });

  it('falls back to "unidentified" when speaker is missing', () => {
    const c = buildCitation({ speaker: undefined as unknown as string });
    expect(buildCitationAriaLabel(c)).toMatch(/speaker unidentified/);
  });
});
