import { describe, expect, it } from 'vitest';

import { deriveReceiptStream } from './use-receipt-stream.js';

const ONE_MIN_MS = 60 * 1000;

const buildInput = (overrides: Partial<Parameters<typeof deriveReceiptStream>[0]> = {}) => ({
  stoppedAtMs: 1_700_000_000_000,
  transcriptAtMs: null,
  summaryAtMs: null,
  actionItemsAtMs: null,
  analysisAtMs: null,
  vertical: 'general' as const,
  now: 1_700_000_000_000,
  ...overrides,
});

describe('deriveReceiptStream', () => {
  it('marks every stage pending in the first 5 seconds', () => {
    const r = deriveReceiptStream(buildInput({ now: 1_700_000_002_000 }));
    expect(r.stages.every((s) => s.status === 'pending')).toBe(true);
    expect(r.allComplete).toBe(false);
  });

  it('marks every incomplete stage in-flight after 5s', () => {
    const r = deriveReceiptStream(buildInput({ now: 1_700_000_010_000 }));
    expect(r.stages.every((s) => s.status === 'in-flight')).toBe(true);
  });

  it('marks completed stages "complete" once the timestamp lands', () => {
    const r = deriveReceiptStream(
      buildInput({
        transcriptAtMs: 1_700_000_030_000,
        now: 1_700_000_060_000,
      }),
    );
    const transcript = r.stages.find((s) => s.stage === 'transcript');
    expect(transcript?.status).toBe('complete');
    const summary = r.stages.find((s) => s.stage === 'summary');
    expect(summary?.status).toBe('in-flight');
  });

  it('flips incomplete stages to "overdue" past the 3-min general SLA', () => {
    const r = deriveReceiptStream(
      buildInput({
        now: 1_700_000_000_000 + 4 * ONE_MIN_MS,
      }),
    );
    expect(r.stages.every((s) => s.status === 'overdue')).toBe(true);
    expect(r.etaCopy).toMatch(/Still working/);
  });

  it('uses a 30-min window for clinical verticals', () => {
    const r = deriveReceiptStream(
      buildInput({
        vertical: 'medical',
        now: 1_700_000_000_000 + 5 * ONE_MIN_MS,
      }),
    );
    // 5 min into a 30-min budget — still in-flight, not overdue.
    expect(r.stages.every((s) => s.status === 'in-flight')).toBe(true);
    expect(r.etaCopy).toMatch(/min/);
  });

  it('sets allComplete and clears etaCopy when every stage lands', () => {
    const r = deriveReceiptStream(
      buildInput({
        transcriptAtMs: 1_700_000_010_000,
        summaryAtMs: 1_700_000_020_000,
        actionItemsAtMs: 1_700_000_030_000,
        analysisAtMs: 1_700_000_040_000,
        now: 1_700_000_050_000,
      }),
    );
    expect(r.allComplete).toBe(true);
    expect(r.etaCopy).toBe('');
  });
});
