import { describe, expect, it } from 'vitest';

import { deriveReceiptSkeletonStage } from './use-receipt-skeleton-stage.js';

const baseInput = {
  hasRecording: false,
  uploadedAtMs: null,
  transcriptCompletedAtMs: null,
  summaryCompletedAtMs: null,
  analysisCompletedAtMs: null,
  failureKind: null,
  isCapturing: false,
};

describe('deriveReceiptSkeletonStage', () => {
  it('returns "idle" with no progress when nothing is happening', () => {
    const r = deriveReceiptSkeletonStage(baseInput);
    expect(r.stage).toBe('idle');
    expect(r.progress).toBe(0);
    expect(r.ariaBusy).toBe(false);
  });

  it('returns "capturing" while live capture is active', () => {
    const r = deriveReceiptSkeletonStage({ ...baseInput, isCapturing: true });
    expect(r.stage).toBe('capturing');
    expect(r.ariaBusy).toBe(true);
  });

  it('advances to "uploading" once a recording exists', () => {
    const r = deriveReceiptSkeletonStage({ ...baseInput, hasRecording: true });
    expect(r.stage).toBe('uploading');
  });

  it('advances to "transcribing" once upload is complete', () => {
    const r = deriveReceiptSkeletonStage({
      ...baseInput,
      hasRecording: true,
      uploadedAtMs: 1_700_000_000_000,
    });
    expect(r.stage).toBe('transcribing');
    expect(r.label).toBe('Transcribing audio…');
  });

  it('advances to "summarizing" once transcript lands', () => {
    const r = deriveReceiptSkeletonStage({
      ...baseInput,
      hasRecording: true,
      uploadedAtMs: 1_700_000_000_000,
      transcriptCompletedAtMs: 1_700_000_010_000,
    });
    expect(r.stage).toBe('summarizing');
  });

  it('advances to "analyzing" once summary lands', () => {
    const r = deriveReceiptSkeletonStage({
      ...baseInput,
      hasRecording: true,
      uploadedAtMs: 1,
      transcriptCompletedAtMs: 2,
      summaryCompletedAtMs: 3,
    });
    expect(r.stage).toBe('analyzing');
    expect(r.progress).toBeGreaterThan(0.5);
  });

  it('returns "ready" once analysis completes', () => {
    const r = deriveReceiptSkeletonStage({
      ...baseInput,
      hasRecording: true,
      uploadedAtMs: 1,
      transcriptCompletedAtMs: 2,
      summaryCompletedAtMs: 3,
      analysisCompletedAtMs: 4,
    });
    expect(r.stage).toBe('ready');
    expect(r.progress).toBe(1);
    expect(r.ariaBusy).toBe(false);
  });

  it('returns "failed" when a failure kind is set', () => {
    const r = deriveReceiptSkeletonStage({
      ...baseInput,
      hasRecording: true,
      uploadedAtMs: 1,
      transcriptCompletedAtMs: 2,
      failureKind: 'summary',
    });
    expect(r.stage).toBe('failed');
    expect(r.label).toBe('Summary failed.');
  });
});
