import { describe, expect, it } from 'vitest';
import { type RecordingMachineState, recordingReducer } from './use-recording-state-machine';

const idle: RecordingMachineState = { kind: 'idle' };

describe('recordingReducer', () => {
  it('transitions idle → requesting-consent on request-consent', () => {
    const next = recordingReducer(idle, { type: 'request-consent' });
    expect(next.kind).toBe('requesting-consent');
  });

  it('ignores request-consent if not idle', () => {
    const recording: RecordingMachineState = { kind: 'recording', startedAt: 1 };
    const next = recordingReducer(recording, { type: 'request-consent' });
    expect(next).toBe(recording);
  });

  it('transitions requesting-consent → recording on consent-granted', () => {
    const next = recordingReducer(
      { kind: 'requesting-consent' },
      { type: 'consent-granted', deviceName: 'Built-in mic' },
    );
    expect(next.kind).toBe('recording');
    if (next.kind === 'recording') {
      expect(next.deviceName).toBe('Built-in mic');
      expect(typeof next.startedAt).toBe('number');
    }
  });

  it('transitions requesting-consent → error on consent-denied', () => {
    const next = recordingReducer(
      { kind: 'requesting-consent' },
      { type: 'consent-denied', reason: 'user cancelled' },
    );
    expect(next.kind).toBe('error');
    if (next.kind === 'error') {
      expect(next.reason).toBe('user cancelled');
      expect(next.retryable).toBe(true);
    }
  });

  it('pauses and resumes recording', () => {
    const recording: RecordingMachineState = { kind: 'recording', startedAt: 100 };
    const paused = recordingReducer(recording, { type: 'pause' });
    expect(paused.kind).toBe('paused');
    if (paused.kind !== 'paused') return;
    expect(paused.startedAt).toBe(100);
    const resumed = recordingReducer(paused, { type: 'resume' });
    expect(resumed.kind).toBe('recording');
    if (resumed.kind === 'recording') {
      expect(resumed.startedAt).toBe(100);
    }
  });

  it('only allows stop from recording or paused', () => {
    expect(recordingReducer(idle, { type: 'stop' })).toBe(idle);
    const fromRecording = recordingReducer({ kind: 'recording', startedAt: 1 }, { type: 'stop' });
    expect(fromRecording.kind).toBe('stopping');
    const fromPaused = recordingReducer(
      { kind: 'paused', startedAt: 1, pausedAt: 2 },
      { type: 'stop' },
    );
    expect(fromPaused.kind).toBe('stopping');
  });

  it('walks the upload happy path', () => {
    const stopping: RecordingMachineState = { kind: 'stopping' };
    const uploading = recordingReducer(stopping, {
      type: 'upload-started',
      recordingId: 'r1',
    });
    expect(uploading.kind).toBe('uploading');
    const progressed = recordingReducer(uploading, { type: 'upload-progress', progress: 0.5 });
    if (progressed.kind === 'uploading') {
      expect(progressed.progress).toBe(0.5);
    }
    const finished = recordingReducer(progressed, { type: 'upload-finished' });
    expect(finished.kind).toBe('idle');
  });

  it('clamps upload progress to [0, 1]', () => {
    const start = recordingReducer(
      { kind: 'stopping' },
      { type: 'upload-started', recordingId: 'r1' },
    );
    const high = recordingReducer(start, { type: 'upload-progress', progress: 5 });
    if (high.kind === 'uploading') expect(high.progress).toBe(1);
    const low = recordingReducer(start, { type: 'upload-progress', progress: -2 });
    if (low.kind === 'uploading') expect(low.progress).toBe(0);
  });

  it('fail can fire from any state and reset returns to idle', () => {
    const failed = recordingReducer(
      { kind: 'recording', startedAt: 1 },
      { type: 'fail', reason: 'mic unplugged', retryable: true },
    );
    expect(failed.kind).toBe('error');
    const reset = recordingReducer(failed, { type: 'reset' });
    expect(reset.kind).toBe('idle');
  });
});
