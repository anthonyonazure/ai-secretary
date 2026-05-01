import { describe, expect, it } from 'vitest';

import { deriveMeetingExportState } from './use-meeting-export-state.js';

describe('deriveMeetingExportState', () => {
  it('enables transcript and summary by default', () => {
    const r = deriveMeetingExportState({
      meetingId: 'm-1',
      recentExports: [],
      isClinicalVertical: false,
      hasAnalysis: true,
    });
    const tx = r.formats.find((f) => f.format === 'transcript-txt');
    const summary = r.formats.find((f) => f.format === 'summary-md');
    expect(tx?.enabled).toBe(true);
    expect(summary?.enabled).toBe(true);
  });

  it('disables analysis export when no analysis exists yet', () => {
    const r = deriveMeetingExportState({
      meetingId: 'm-1',
      recentExports: [],
      isClinicalVertical: false,
      hasAnalysis: false,
    });
    const analysis = r.formats.find((f) => f.format === 'analysis-json');
    expect(analysis?.enabled).toBe(false);
    expect(analysis?.reason).toBe('no-analysis-yet');
  });

  it('blocks raw-audio export for clinical verticals', () => {
    const r = deriveMeetingExportState({
      meetingId: 'm-1',
      recentExports: [],
      isClinicalVertical: true,
      hasAnalysis: true,
    });
    const audio = r.formats.find((f) => f.format === 'audio-mp3');
    expect(audio?.enabled).toBe(false);
    expect(audio?.reason).toBe('clinical-restriction');
  });

  it('imposes a 30s cooldown after a successful export', () => {
    const now = 1_700_000_000_000;
    const r = deriveMeetingExportState({
      meetingId: 'm-1',
      recentExports: [
        {
          meetingId: 'm-1',
          format: 'transcript-txt',
          startedAtMs: now - 20_000,
          completedAtMs: now - 10_000,
          failedReason: null,
        },
      ],
      isClinicalVertical: false,
      hasAnalysis: true,
      now,
    });
    expect(r.cooldownMsRemaining).toBe(20_000);
    const tx = r.formats.find((f) => f.format === 'transcript-txt');
    expect(tx?.enabled).toBe(false);
    expect(tx?.reason).toBe('cooldown');
  });

  it('marks an in-flight export', () => {
    const now = 1_700_000_000_000;
    const r = deriveMeetingExportState({
      meetingId: 'm-1',
      recentExports: [
        {
          meetingId: 'm-1',
          format: 'summary-md',
          startedAtMs: now - 5_000,
          completedAtMs: null,
          failedReason: null,
        },
      ],
      isClinicalVertical: false,
      hasAnalysis: true,
      now,
    });
    const summary = r.formats.find((f) => f.format === 'summary-md');
    expect(summary?.inFlight).toBe(true);
  });

  it('surfaces the most-recent failure reason on a format', () => {
    const now = 1_700_000_000_000;
    const r = deriveMeetingExportState({
      meetingId: 'm-1',
      recentExports: [
        {
          meetingId: 'm-1',
          format: 'analysis-json',
          startedAtMs: now - 60_000,
          completedAtMs: null,
          failedReason: 'rate-limited',
        },
      ],
      isClinicalVertical: false,
      hasAnalysis: true,
      now,
    });
    const analysis = r.formats.find((f) => f.format === 'analysis-json');
    expect(analysis?.lastFailedReason).toBe('rate-limited');
  });

  it('only inspects exports for the current meeting', () => {
    const now = 1_700_000_000_000;
    const r = deriveMeetingExportState({
      meetingId: 'm-1',
      recentExports: [
        {
          meetingId: 'OTHER',
          format: 'transcript-txt',
          startedAtMs: now - 5_000,
          completedAtMs: now - 2_000,
          failedReason: null,
        },
      ],
      isClinicalVertical: false,
      hasAnalysis: true,
      now,
    });
    expect(r.cooldownMsRemaining).toBe(0);
    const tx = r.formats.find((f) => f.format === 'transcript-txt');
    expect(tx?.enabled).toBe(true);
  });
});
