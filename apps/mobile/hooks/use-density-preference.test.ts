import { describe, expect, it } from 'vitest';

import { resolveDensity, verticalDefaultDensity } from './use-density-preference.js';

describe('resolveDensity', () => {
  it('honors an explicit user override above all else', () => {
    const r = resolveDensity({
      userOverride: 'dense',
      osPrefersContrast: true,
      osPrefersReducedMotion: true,
      verticalDefault: 'relaxed',
    });
    expect(r.mode).toBe('dense');
    expect(r.source).toBe('override');
  });

  it('falls back to "accessible" when the OS prefers contrast', () => {
    const r = resolveDensity({
      userOverride: null,
      osPrefersContrast: true,
      osPrefersReducedMotion: false,
      verticalDefault: 'dense',
    });
    expect(r.mode).toBe('accessible');
    expect(r.source).toBe('os');
  });

  it('falls back to "accessible" when the OS prefers reduced motion', () => {
    const r = resolveDensity({
      userOverride: null,
      osPrefersContrast: false,
      osPrefersReducedMotion: true,
      verticalDefault: 'dense',
    });
    expect(r.mode).toBe('accessible');
  });

  it('falls back to the vertical default when no OS or user signals are present', () => {
    const r = resolveDensity({
      userOverride: null,
      osPrefersContrast: false,
      osPrefersReducedMotion: false,
      verticalDefault: 'relaxed',
    });
    expect(r.mode).toBe('relaxed');
    expect(r.source).toBe('vertical');
  });
});

describe('verticalDefaultDensity', () => {
  it('returns "relaxed" for clinical verticals', () => {
    expect(verticalDefaultDensity('medical')).toBe('relaxed');
    expect(verticalDefaultDensity('psychology')).toBe('relaxed');
  });

  it('returns "dense" for non-clinical verticals', () => {
    expect(verticalDefaultDensity('sales')).toBe('dense');
    expect(verticalDefaultDensity('hr')).toBe('dense');
    expect(verticalDefaultDensity('general')).toBe('dense');
    expect(verticalDefaultDensity('education')).toBe('dense');
    expect(verticalDefaultDensity('support')).toBe('dense');
    expect(verticalDefaultDensity('pm')).toBe('dense');
  });
});
