import { describe, expect, it } from 'vitest';

import { contrastRatio, findFailures, parseHex, relativeLuminance } from './contrast.js';
import type { ContrastReport } from './contrast.js';

describe('parseHex', () => {
  it('parses 6-char hex', () => {
    expect(parseHex('#ffffff')).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseHex('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('parses 3-char hex by expansion', () => {
    expect(parseHex('#fff')).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('strips alpha channel from 8-char hex', () => {
    expect(parseHex('#ffffff80')).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('returns null on garbage', () => {
    expect(parseHex('not-a-color')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('white is 1.0', () => {
    expect(relativeLuminance({ r: 1, g: 1, b: 1 })).toBeCloseTo(1.0, 4);
  });

  it('black is 0.0', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0.0, 4);
  });
});

describe('contrastRatio', () => {
  it('white-on-black is 21:1', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('same color is 1:1', () => {
    expect(contrastRatio('#4f46e5', '#4f46e5')).toBeCloseTo(1, 4);
  });

  it('locked accent on white passes AA body (4.5:1)', () => {
    // Light-theme accent #4f46e5 on #ffffff bg.
    expect(contrastRatio('#4f46e5', '#ffffff')).toBeGreaterThan(4.5);
  });
});

describe('findFailures', () => {
  it('flags body pair below 4.5:1', () => {
    const report: ContrastReport = {
      generatedAt: '2026-04-29T00:00:00Z',
      pairs: [
        {
          fg: '--color-fg',
          bg: '--color-bg',
          fgValue: '#888888',
          bgValue: '#ffffff',
          ratio: 3.5,
          kind: 'body',
          scope: ':root',
        },
      ],
    };
    const failures = findFailures(report);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.threshold).toBe(4.5);
  });

  it('passes large/non-text pairs above 3:1', () => {
    const report: ContrastReport = {
      generatedAt: '2026-04-29T00:00:00Z',
      pairs: [
        {
          fg: '--color-border',
          bg: '--color-bg',
          fgValue: '#888888',
          bgValue: '#ffffff',
          ratio: 3.5,
          kind: 'non-text',
          scope: ':root',
        },
      ],
    };
    expect(findFailures(report)).toHaveLength(0);
  });

  it('returns empty list when all pairs pass', () => {
    const report: ContrastReport = {
      generatedAt: '2026-04-29T00:00:00Z',
      pairs: [
        {
          fg: '--color-fg',
          bg: '--color-bg',
          fgValue: '#0a0a0a',
          bgValue: '#ffffff',
          ratio: 19.5,
          kind: 'body',
          scope: ':root',
        },
      ],
    };
    expect(findFailures(report)).toHaveLength(0);
  });
});
