import { describe, expect, it } from 'vitest';

import { collectCitationTurnIds, countClaims, flattenClaims } from './module-output-helpers.js';
import type { ModuleOutput } from './schemas/module-output.js';

const cite = (turnId: string) => ({
  meetingId: '00000000-0000-0000-0000-000000000abc',
  turnId,
  spanStartMs: 0,
  spanEndMs: 1000,
});

const generalOutput: ModuleOutput = {
  module: 'general',
  title: 'Quick read',
  summary: 'A 22-minute conversation',
  bullets: [
    { claim: 'Three decisions made.', citations: [cite('t-1')] },
    { claim: 'Customers asking about EU residency.', citations: [cite('t-2'), cite('t-3')] },
    { claim: 'Ungrounded claim.', citations: [] },
  ],
};

const salesOutput: ModuleOutput = {
  module: 'sales',
  title: 'Acme — discovery',
  summary: 'Champion confirmed.',
  bullets: [],
  talkRatio: { self: 0.4, counterpart: 0.6 },
  objections: [{ claim: 'SOC2 required.', citations: [cite('t-9')] }],
  nextSteps: [{ claim: 'Send security pack.', citations: [] }],
  dealRisk: 'medium',
};

describe('flattenClaims', () => {
  it('extracts bullets from a general module', () => {
    const flat = flattenClaims(generalOutput);
    expect(flat).toHaveLength(3);
    expect(flat[0]?.path).toBe('bullets[0]');
  });

  it('extracts module-specific slots from a sales module', () => {
    const flat = flattenClaims(salesOutput);
    expect(flat.map((c) => c.path)).toEqual(['objections[0]', 'nextSteps[0]']);
  });

  it('returns empty for a bullet-less module without specific slots', () => {
    const minimal: ModuleOutput = {
      module: 'general',
      title: 'x',
      summary: 'y',
      bullets: [],
    };
    expect(flattenClaims(minimal)).toEqual([]);
  });
});

describe('countClaims', () => {
  it('counts claims, citations, and ungrounded entries', () => {
    expect(countClaims(generalOutput)).toEqual({
      claims: 3,
      citations: 3,
      ungrounded: 1,
    });
  });

  it('counts on a sales-style module with module-specific slots', () => {
    expect(countClaims(salesOutput)).toEqual({
      claims: 2,
      citations: 1,
      ungrounded: 1,
    });
  });
});

describe('collectCitationTurnIds', () => {
  it('returns the unique turn ids referenced', () => {
    expect(collectCitationTurnIds(generalOutput).sort()).toEqual(['t-1', 't-2', 't-3']);
  });

  it('returns an empty array when no citations are present', () => {
    const minimal: ModuleOutput = {
      module: 'general',
      title: 'x',
      summary: 'y',
      bullets: [{ claim: 'no citations', citations: [] }],
    };
    expect(collectCitationTurnIds(minimal)).toEqual([]);
  });
});
