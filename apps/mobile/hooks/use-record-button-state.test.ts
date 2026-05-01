import { describe, expect, it } from 'vitest';

import { deriveRecordButtonState } from './use-record-button-state.js';

describe('deriveRecordButtonState', () => {
  it('renders denied + danger when permission denied', () => {
    const r = deriveRecordButtonState({
      recordingFsm: 'idle',
      permissionStatus: 'denied',
      consentReady: true,
    });
    expect(r.kind).toBe('danger');
    expect(r.disabled).toBe(true);
    expect(r.cta).toBe('request-permission');
  });

  it('renders the request-permission primary CTA when permission is prompt', () => {
    const r = deriveRecordButtonState({
      recordingFsm: 'idle',
      permissionStatus: 'prompt',
      consentReady: true,
    });
    expect(r.kind).toBe('primary');
    expect(r.disabled).toBe(false);
    expect(r.cta).toBe('request-permission');
  });

  it('blocks until consent is acknowledged', () => {
    const r = deriveRecordButtonState({
      recordingFsm: 'idle',
      permissionStatus: 'granted',
      consentReady: false,
    });
    expect(r.kind).toBe('muted');
    expect(r.disabled).toBe(true);
    expect(r.cta).toBe('await-consent');
  });

  it('shows Record when idle + ready', () => {
    const r = deriveRecordButtonState({
      recordingFsm: 'idle',
      permissionStatus: 'granted',
      consentReady: true,
    });
    expect(r.label).toBe('Record');
    expect(r.cta).toBe('start-recording');
  });

  it('shows Stop while recording', () => {
    const r = deriveRecordButtonState({
      recordingFsm: 'recording',
      permissionStatus: 'granted',
      consentReady: true,
    });
    expect(r.label).toBe('Stop');
    expect(r.kind).toBe('warning');
    expect(r.cta).toBe('stop-recording');
  });

  it('shows Resume after pause', () => {
    const r = deriveRecordButtonState({
      recordingFsm: 'paused',
      permissionStatus: 'granted',
      consentReady: true,
    });
    expect(r.cta).toBe('resume-recording');
  });

  it('renders Uploading with percentage when uploading', () => {
    const r = deriveRecordButtonState({
      recordingFsm: 'uploading',
      permissionStatus: 'granted',
      consentReady: true,
      bytesUploaded: 250,
      bytesTotal: 1000,
    });
    expect(r.label).toBe('Uploading 25%');
    expect(r.disabled).toBe(true);
  });

  it('renders Retry + danger after failure', () => {
    const r = deriveRecordButtonState({
      recordingFsm: 'failed',
      permissionStatus: 'granted',
      consentReady: true,
    });
    expect(r.label).toBe('Retry');
    expect(r.kind).toBe('danger');
    expect(r.cta).toBe('retry');
  });
});
