import { describe, expect, it } from 'vitest';

import { buildAriaLabel, buildModuleSummaryPreview } from './use-module-summary.js';

describe('buildModuleSummaryPreview', () => {
  it('narrows the input to title + summary + top-N bullets', () => {
    const preview = buildModuleSummaryPreview({
      moduleId: 'sales',
      title: 'Sales — Q4 review',
      summary: 'Pricing came up twice. Two next-steps captured.',
      bullets: [
        { claim: 'Pricing concern raised', citations: [{ x: 1 }, { x: 2 }] },
        { claim: 'Send SOC 2 questionnaire', citations: [{ x: 1 }] },
        { claim: 'Schedule follow-up' },
        { claim: 'Loop in legal' },
      ],
      confidence: 'high',
    });
    expect(preview.title).toBe('Sales — Q4 review');
    expect(preview.topBullets).toHaveLength(3);
    expect(preview.topBullets[0]?.citationCount).toBe(2);
    expect(preview.topBullets[2]?.citationCount).toBe(0);
    expect(preview.confidence).toBe('high');
  });

  it('defaults missing bullets to an empty array', () => {
    const preview = buildModuleSummaryPreview({
      moduleId: 'general',
      title: 'General',
      summary: 'Nothing structured.',
    });
    expect(preview.topBullets).toEqual([]);
    expect(preview.confidence).toBeNull();
  });

  it('honors the topN override', () => {
    const preview = buildModuleSummaryPreview(
      {
        moduleId: 'general',
        title: 'A',
        summary: 'b',
        bullets: Array.from({ length: 5 }, (_, i) => ({
          claim: `bullet ${i}`,
          citations: [],
        })),
      },
      { topN: 2 },
    );
    expect(preview.topBullets).toHaveLength(2);
  });
});

describe('buildAriaLabel', () => {
  it('combines title + confidence into a screen-reader-friendly label', () => {
    expect(
      buildAriaLabel({
        moduleId: 'general',
        title: 'General',
        summary: '',
        topBullets: [],
        confidence: 'high',
      }),
    ).toBe('General — high confidence');
  });

  it('handles low + null confidence', () => {
    const base = {
      moduleId: 'general' as const,
      title: 'General',
      summary: '',
      topBullets: [],
    };
    expect(buildAriaLabel({ ...base, confidence: 'low' })).toMatch(/low confidence/);
    expect(buildAriaLabel({ ...base, confidence: null })).toMatch(/confidence not yet scored/);
  });
});
