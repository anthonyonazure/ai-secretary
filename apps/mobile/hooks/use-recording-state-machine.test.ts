import { describe, expect, it } from 'vitest';
import { type RecordingMachineState, recordingReducer } from './use-recording-state-machine';

const idle: RecordingMachineState = { kind: 'idle' };

describe('recordingReducer (mobile)', () => {
  it('transitions idle → requesting-consent', () => {
    expect(recordingReducer(idle, { type: 'request-consent' }).kind).toBe('requesting-consent');
  });

  it('grants consent → recording with optional deviceName', () => {
    const next = recordingReducer(
      { kind: 'requesting-consent' },
      { type: 'consent-granted', deviceName: 'Internal mic' },
    );
    expect(next.kind).toBe('recording');
    if (next.kind === 'recording') {
      expect(next.deviceName).toBe('Internal mic');
    }
  });

  it('denies consent → error retryable', () => {
    const next = recordingReducer(
      { kind: 'requesting-consent' },
      { type: 'consent-denied', reason: 'denied' },
    );
    expect(next.kind).toBe('error');
    if (next.kind === 'error') {
      expect(next.retryable).toBe(true);
    }
  });

  it('refuses upload-started unless preceded by stopping', () => {
    const recording: RecordingMachineState = { kind: 'recording', startedAt: 1 };
    const next = recordingReducer(recording, { type: 'upload-started', recordingId: 'r' });
    expect(next).toBe(recording);
  });

  it('clamps progress and ends at idle', () => {
    let s: RecordingMachineState = { kind: 'stopping' };
    s = recordingReducer(s, { type: 'upload-started', recordingId: 'r' });
    s = recordingReducer(s, { type: 'upload-progress', progress: 0.7 });
    if (s.kind === 'uploading') expect(s.progress).toBe(0.7);
    s = recordingReducer(s, { type: 'upload-finished' });
    expect(s.kind).toBe('idle');
  });

  it('reset returns to idle from any state', () => {
    const errored: RecordingMachineState = { kind: 'error', reason: 'x', retryable: false };
    expect(recordingReducer(errored, { type: 'reset' }).kind).toBe('idle');
  });
});
