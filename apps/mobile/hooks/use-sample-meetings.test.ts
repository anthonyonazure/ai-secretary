import { describe, expect, it } from 'vitest';

import { SAMPLE_MEETINGS, filterSamplesByVertical } from './use-sample-meetings.js';

describe('SAMPLE_MEETINGS', () => {
  it('exports a non-empty fixture set', () => {
    expect(SAMPLE_MEETINGS.length).toBeGreaterThan(0);
  });

  it('every fixture has the required fields', () => {
    for (const sample of SAMPLE_MEETINGS) {
      expect(sample.id).toBeTruthy();
      expect(sample.title).toBeTruthy();
      expect(sample.duration).toBeTruthy();
      expect(sample.summary).toBeTruthy();
    }
  });

  it('every fixture id is unique', () => {
    const ids = SAMPLE_MEETINGS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('filterSamplesByVertical', () => {
  it('returns every sample when vertical is null', () => {
    expect(filterSamplesByVertical(null)).toHaveLength(SAMPLE_MEETINGS.length);
  });

  it('filters by vertical correctly', () => {
    const sales = filterSamplesByVertical('sales');
    expect(sales.length).toBeGreaterThan(0);
    expect(sales.every((s) => s.vertical === 'sales')).toBe(true);
  });

  it('returns an empty array for an unrepresented vertical', () => {
    // 'support' has no fixture in the seed library.
    expect(filterSamplesByVertical('support')).toEqual([]);
  });
});
