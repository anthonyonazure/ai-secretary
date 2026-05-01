import { describe, expect, it } from 'vitest';

import { decideBotFallback } from './use-bot-fallback-decision.js';

const baseInput = {
  failureKind: 'failed-to-join' as const,
  platform: 'zoom' as const,
  meetingHasEnded: true,
  cloudRecordingEnabled: true,
  isClinicalVertical: false,
  hasReschedulePermission: true,
};

describe('decideBotFallback', () => {
  it('prefers cloud-fetch when meeting ended + cloud is available on Zoom', () => {
    const r = decideBotFallback(baseInput);
    expect(r.primary).toBe('cloud-fetch');
    expect(r.alternates).toContain('manual-upload');
  });

  it('also supports cloud-fetch on Teams', () => {
    const r = decideBotFallback({ ...baseInput, platform: 'teams' });
    expect(r.primary).toBe('cloud-fetch');
  });

  it('falls back to manual-upload when cloud is unavailable on Meet (non-clinical)', () => {
    const r = decideBotFallback({
      ...baseInput,
      platform: 'meet',
      cloudRecordingEnabled: false,
    });
    expect(r.primary).toBe('manual-upload');
  });

  it('blocks manual-upload alternate on clinical verticals (PHI containment)', () => {
    const r = decideBotFallback({ ...baseInput, isClinicalVertical: true });
    expect(r.primary).toBe('cloud-fetch');
    expect(r.alternates).toEqual([]);
  });

  it('falls back to manual-notes-only on a clinical vertical with no cloud', () => {
    const r = decideBotFallback({
      ...baseInput,
      platform: 'meet',
      cloudRecordingEnabled: false,
      isClinicalVertical: true,
    });
    expect(r.primary).toBe('manual-notes-only');
  });

  it('reconnects when bot drops mid-meeting and reschedule is allowed', () => {
    const r = decideBotFallback({
      ...baseInput,
      failureKind: 'dropped-mid-meeting',
      meetingHasEnded: false,
    });
    expect(r.primary).toBe('reschedule-bot');
  });

  it('reschedules on a rate-limited failure', () => {
    const r = decideBotFallback({
      ...baseInput,
      failureKind: 'rate-limited',
      meetingHasEnded: false,
    });
    expect(r.primary).toBe('reschedule-bot');
  });

  it('routes platform-unsupported clinical to manual-notes-only', () => {
    const r = decideBotFallback({
      ...baseInput,
      failureKind: 'platform-unsupported',
      isClinicalVertical: true,
    });
    expect(r.primary).toBe('manual-notes-only');
  });

  it('routes platform-unsupported non-clinical to manual-upload', () => {
    const r = decideBotFallback({
      ...baseInput,
      failureKind: 'platform-unsupported',
    });
    expect(r.primary).toBe('manual-upload');
  });

  it('falls back gracefully when reschedule isn’t permitted mid-meeting', () => {
    const r = decideBotFallback({
      ...baseInput,
      failureKind: 'dropped-mid-meeting',
      meetingHasEnded: false,
      hasReschedulePermission: false,
    });
    expect(r.primary).not.toBe('reschedule-bot');
  });
});
