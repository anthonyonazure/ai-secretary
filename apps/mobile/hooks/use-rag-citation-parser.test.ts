import { describe, expect, it } from 'vitest';

import {
  countRagCitations,
  isUngroundedClaim,
  parseRagResponse,
} from './use-rag-citation-parser.js';

describe('parseRagResponse', () => {
  it('returns an empty list for empty input', () => {
    expect(parseRagResponse('')).toEqual([]);
  });

  it('returns a single text segment for a string with no citations', () => {
    const r = parseRagResponse('Just plain text.');
    expect(r).toEqual([{ kind: 'text', text: 'Just plain text.' }]);
  });

  it('extracts a single inline citation', () => {
    const r = parseRagResponse('The team agreed [cite:1] on the next step.');
    expect(r).toEqual([
      { kind: 'text', text: 'The team agreed ' },
      { kind: 'citation', index: 1 },
      { kind: 'text', text: ' on the next step.' },
    ]);
  });

  it('handles multiple citations in order', () => {
    const r = parseRagResponse('Two decisions [cite:1] and one risk [cite:42].');
    expect(
      r.filter((s) => s.kind === 'citation').map((s) => (s as { index: number }).index),
    ).toEqual([1, 42]);
  });

  it('treats consecutive citations correctly', () => {
    const r = parseRagResponse('Multiple sources [cite:1][cite:2] support this.');
    const citations = r.filter((s) => s.kind === 'citation');
    expect(citations).toHaveLength(2);
  });

  it('ignores malformed citation tags', () => {
    const r = parseRagResponse('Bad [cite:abc] tag.');
    expect(r).toEqual([{ kind: 'text', text: 'Bad [cite:abc] tag.' }]);
  });
});

describe('countRagCitations', () => {
  it('counts citations across a response', () => {
    expect(countRagCitations('A [cite:1] and [cite:2] and [cite:3].')).toBe(3);
  });

  it('returns 0 when none are present', () => {
    expect(countRagCitations('No citations here.')).toBe(0);
  });
});

describe('isUngroundedClaim', () => {
  it('flags a long claim with no citations', () => {
    expect(isUngroundedClaim('The customer agreed to a Q3 expansion across all regions.')).toBe(
      true,
    );
  });

  it('passes a short fragment (likely a hedge or interjection)', () => {
    expect(isUngroundedClaim('Yes.')).toBe(false);
  });

  it('passes a long claim that has at least one citation', () => {
    expect(
      isUngroundedClaim('The customer agreed to a Q3 expansion across all regions [cite:1].'),
    ).toBe(false);
  });
});
