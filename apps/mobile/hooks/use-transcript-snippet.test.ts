import { describe, expect, it } from 'vitest';

import {
  parseSnippet,
  plainSnippet,
  truncateAroundFirstHighlight,
} from './use-transcript-snippet.js';

describe('parseSnippet', () => {
  it('returns an empty array for an empty input', () => {
    expect(parseSnippet('')).toEqual([]);
  });

  it('returns a single un-highlighted part when there are no <mark> tags', () => {
    expect(parseSnippet('Just text.')).toEqual([{ text: 'Just text.', highlighted: false }]);
  });

  it('parses one highlighted span surrounded by plain text', () => {
    const result = parseSnippet('Their <mark>pricing</mark> question came up.');
    expect(result).toEqual([
      { text: 'Their ', highlighted: false },
      { text: 'pricing', highlighted: true },
      { text: ' question came up.', highlighted: false },
    ]);
  });

  it('parses multiple highlighted spans', () => {
    const result = parseSnippet('A <mark>tier</mark> + <mark>price</mark> conversation.');
    expect(result.filter((p) => p.highlighted).map((p) => p.text)).toEqual(['tier', 'price']);
  });
});

describe('plainSnippet', () => {
  it('strips mark tags', () => {
    expect(plainSnippet('Their <mark>pricing</mark> question.')).toBe('Their pricing question.');
  });
});

describe('truncateAroundFirstHighlight', () => {
  it('returns the original snippet when it fits', () => {
    expect(truncateAroundFirstHighlight('short <mark>x</mark> snippet')).toBe(
      'short <mark>x</mark> snippet',
    );
  });

  it('clips around the first highlighted span when too long', () => {
    const long = `${'a'.repeat(200)} <mark>HIT</mark> ${'b'.repeat(200)}`;
    const truncated = truncateAroundFirstHighlight(long, 30);
    expect(truncated).toContain('<mark>HIT</mark>');
    expect(truncated.startsWith('…')).toBe(true);
    expect(truncated.endsWith('…')).toBe(true);
    expect(truncated.length).toBeLessThan(long.length);
  });

  it('returns a truncated head when there is no highlight', () => {
    const long = 'a'.repeat(500);
    const truncated = truncateAroundFirstHighlight(long, 50);
    expect(truncated.length).toBeLessThan(long.length);
    expect(truncated.endsWith('…')).toBe(true);
  });
});
