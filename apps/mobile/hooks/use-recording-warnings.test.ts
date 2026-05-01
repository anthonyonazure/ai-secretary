import { describe, expect, it } from 'vitest';

import { deriveRecordingWarnings } from './use-recording-warnings.js';

const baseInput = {
  micPermission: 'granted' as const,
  freeDiskBytes: 5 * 1024 * 1024 * 1024,
  estimatedRecordingBytes: 100 * 1024 * 1024,
  isBackgroundCaptureEnabled: true,
  hasConsentAck: true,
  isOnCellular: false,
  cellularUploadAllowed: true,
  batteryPercent: 80,
};

describe('deriveRecordingWarnings', () => {
  it('returns no warnings when everything is set up', () => {
    const r = deriveRecordingWarnings(baseInput);
    expect(r.warnings).toHaveLength(0);
    expect(r.canStartRecording).toBe(true);
  });

  it('blocks recording when mic permission is denied', () => {
    const r = deriveRecordingWarnings({ ...baseInput, micPermission: 'denied' });
    expect(r.canStartRecording).toBe(false);
    expect(r.warnings.some((w) => w.kind === 'mic-denied')).toBe(true);
  });

  it('blocks recording when consent is not acknowledged', () => {
    const r = deriveRecordingWarnings({ ...baseInput, hasConsentAck: false });
    expect(r.canStartRecording).toBe(false);
    expect(r.warnings.some((w) => w.kind === 'consent-not-acknowledged')).toBe(true);
  });

  it('warns but does not block on low storage', () => {
    const r = deriveRecordingWarnings({
      ...baseInput,
      freeDiskBytes: 50 * 1024 * 1024,
    });
    expect(r.canStartRecording).toBe(true);
    expect(r.warnings.some((w) => w.kind === 'storage-low')).toBe(true);
  });

  it('warns when background capture is off', () => {
    const r = deriveRecordingWarnings({
      ...baseInput,
      isBackgroundCaptureEnabled: false,
    });
    expect(r.canStartRecording).toBe(true);
    const warning = r.warnings.find((w) => w.kind === 'background-disabled');
    expect(warning?.severity).toBe('warning');
  });

  it('shows cellular hint only when on cellular and uploads disallowed', () => {
    const r = deriveRecordingWarnings({
      ...baseInput,
      isOnCellular: true,
      cellularUploadAllowed: false,
    });
    expect(r.warnings.some((w) => w.kind === 'cellular-data-warning')).toBe(true);
  });

  it('does NOT show cellular hint when uploads are allowed on cellular', () => {
    const r = deriveRecordingWarnings({ ...baseInput, isOnCellular: true });
    expect(r.warnings.some((w) => w.kind === 'cellular-data-warning')).toBe(false);
  });

  it('warns at low battery (≤ 15%)', () => {
    const r = deriveRecordingWarnings({ ...baseInput, batteryPercent: 12 });
    expect(r.warnings.some((w) => w.kind === 'battery-low')).toBe(true);
  });

  it('does not warn at high battery', () => {
    const r = deriveRecordingWarnings({ ...baseInput, batteryPercent: 90 });
    expect(r.warnings.some((w) => w.kind === 'battery-low')).toBe(false);
  });

  it('stacks multiple warnings simultaneously', () => {
    const r = deriveRecordingWarnings({
      ...baseInput,
      isBackgroundCaptureEnabled: false,
      batteryPercent: 10,
      freeDiskBytes: 50 * 1024 * 1024,
    });
    expect(r.warnings.length).toBeGreaterThanOrEqual(3);
  });
});
