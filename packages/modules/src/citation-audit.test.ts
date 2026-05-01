import type { ModuleOutput } from '@aisecretary/shared';
import { describe, expect, it } from 'vitest';

import { auditAllCitations, auditCitations } from './citation-audit.js';

const meetingId = '00000000-0000-4000-8000-000000000001';
const cite = (turnId: string) => ({
  meetingId,
  turnId,
  spanStartMs: 0,
  spanEndMs: 1000,
});

describe('auditCitations (Story 3.6)', () => {
  it('passes a general output with citations on every bullet', () => {
    const output: ModuleOutput = {
      module: 'general',
      title: 'Q3 sync',
      summary: 'aligned on roadmap',
      bullets: [
        { claim: 'shipped pricing page', citations: [cite('t-1')] },
        { claim: 'set the Q4 OKRs', citations: [cite('t-2'), cite('t-3')] },
      ],
    };
    const result = auditCitations(output);
    expect(result.missing).toHaveLength(0);
    expect(result.total).toBe(2);
  });

  it('flags a bullet missing citations', () => {
    const output: ModuleOutput = {
      module: 'general',
      title: 't',
      summary: 's',
      bullets: [
        { claim: 'cited claim', citations: [cite('t-1')] },
        { claim: 'uncited claim', citations: [] },
      ],
    };
    const result = auditCitations(output);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]?.path).toBe('bullets[1]');
    expect(result.missing[0]?.claim).toBe('uncited claim');
    expect(result.total).toBe(2);
  });

  it('walks module-specific slots (sales: objections + nextSteps)', () => {
    const output: ModuleOutput = {
      module: 'sales',
      title: 'Acme discovery',
      summary: 'champion confirmed',
      bullets: [{ claim: 'champion confirmed', citations: [cite('t-1')] }],
      objections: [
        { claim: 'wants SOC2 first', citations: [cite('t-2')] },
        { claim: 'pricing too high — no cite', citations: [] },
      ],
      nextSteps: [{ claim: 'send security pack', citations: [] }],
    };
    const result = auditCitations(output);
    expect(result.missing).toHaveLength(2);
    expect(result.missing.map((m) => m.path).sort()).toEqual(['nextSteps[0]', 'objections[1]']);
    expect(result.total).toBe(4);
  });

  it('walks medical risk flags', () => {
    const output: ModuleOutput = {
      module: 'medical',
      title: 'intake',
      summary: 's',
      bullets: [{ claim: 'b', citations: [cite('t-1')] }],
      riskFlags: [{ claim: 'PHQ-9 of 12 — uncited', citations: [] }],
    };
    const result = auditCitations(output);
    expect(result.missing.map((m) => m.path)).toEqual(['riskFlags[0]']);
  });

  it('handles modules with empty slot arrays', () => {
    const output: ModuleOutput = {
      module: 'support',
      title: 't',
      summary: 's',
      bullets: [],
      escalationFlags: [],
    };
    const result = auditCitations(output);
    expect(result.missing).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('aggregates across fixtures with the index attached', () => {
    const outputs: ModuleOutput[] = [
      {
        module: 'general',
        title: 'a',
        summary: 's',
        bullets: [{ claim: 'cited', citations: [cite('t-1')] }],
      },
      {
        module: 'general',
        title: 'b',
        summary: 's',
        bullets: [{ claim: 'uncited', citations: [] }],
      },
    ];
    const result = auditAllCitations(outputs);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]?.fixture).toBe(1);
    expect(result.total).toBe(2);
  });
});
