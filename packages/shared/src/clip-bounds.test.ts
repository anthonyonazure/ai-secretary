import { describe, expect, it } from 'vitest';

import {
  MAX_CLIP_DURATION_MS,
  MIN_CLIP_DURATION_MS,
  clampClipBounds,
  validateClipBounds,
} from './clip-bounds.js';

describe('validateClipBounds', () => {
  it('accepts a bounded clip well inside the recording', () => {
    const r = validateClipBounds({
      startMs: 30_000,
      endMs: 90_000,
      recordingDurationMs: 600_000,
    });
    expect(r.ok).toBe(true);
    expect(r.durationMs).toBe(60_000);
  });

  it('rejects a negative start', () => {
    const r = validateClipBounds({
      startMs: -1,
      endMs: 60_000,
      recordingDurationMs: 600_000,
    });
    expect(r.ok).toBe(false);
    expect(r.violations).toContain('start-negative');
  });

  it('rejects end <= start', () => {
    const r = validateClipBounds({
      startMs: 60_000,
      endMs: 60_000,
      recordingDurationMs: 600_000,
    });
    expect(r.violations).toContain('end-before-start');
  });

  it('rejects clips shorter than 5 seconds', () => {
    const r = validateClipBounds({
      startMs: 0,
      endMs: 4_999,
      recordingDurationMs: 600_000,
    });
    expect(r.violations).toContain('too-short');
  });

  it('rejects clips longer than 10 minutes', () => {
    const r = validateClipBounds({
      startMs: 0,
      endMs: MAX_CLIP_DURATION_MS + 1,
      recordingDurationMs: 30 * 60 * 1000,
    });
    expect(r.violations).toContain('too-long');
  });

  it('rejects clips that overrun the recording length', () => {
    const r = validateClipBounds({
      startMs: 0,
      endMs: 700_000,
      recordingDurationMs: 600_000,
    });
    expect(r.violations).toContain('past-recording-end');
  });

  it('accepts the exact min-duration boundary', () => {
    const r = validateClipBounds({
      startMs: 0,
      endMs: MIN_CLIP_DURATION_MS,
      recordingDurationMs: 60_000,
    });
    expect(r.ok).toBe(true);
  });
});

describe('clampClipBounds', () => {
  it('clamps a start past the recording end back inside while preserving min-duration', () => {
    const r = clampClipBounds({
      startMs: 999_999,
      endMs: 1_000_000,
      recordingDurationMs: 600_000,
    });
    expect(r.endMs).toBe(600_000);
    expect(r.endMs - r.startMs).toBe(MIN_CLIP_DURATION_MS);
  });

  it('keeps a clip at minimum duration when end is too close to start', () => {
    const r = clampClipBounds({
      startMs: 100_000,
      endMs: 100_500,
      recordingDurationMs: 600_000,
    });
    expect(r.endMs - r.startMs).toBe(MIN_CLIP_DURATION_MS);
  });
});
