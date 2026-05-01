// Mirrored shape with apps/mobile/hooks/use-recording-state-machine.ts — keep in sync.
//
// Story 4.2 — one-tap recording state machine. Pure reducer; no platform
// side-effects. The hook in `use-recording.ts` (web) and the parallel mobile
// hook drive transitions and own the platform-specific recorder + uploader.
//
// State shape rationale: discriminated union with `kind` so the UI can
// `switch` exhaustively and TS catches new states. Heartbeat detection
// (Story 4.4) and upload-retry-exhausted escalation (Story 4.5) plug onto
// the `recording` and `uploading` states respectively without changing the
// shape — both stories add behaviour, not new kinds.

import { useCallback, useReducer } from 'react';

export type RecordingMachineState =
  | { kind: 'idle' }
  | { kind: 'requesting-consent' }
  | { kind: 'recording'; startedAt: number; deviceName?: string }
  | { kind: 'paused'; startedAt: number; pausedAt: number }
  | { kind: 'stopping' }
  | { kind: 'uploading'; recordingId: string; progress: number }
  | { kind: 'error'; reason: string; retryable: boolean };

export type RecordingMachineAction =
  | { type: 'request-consent' }
  | { type: 'consent-granted'; deviceName?: string }
  | { type: 'consent-denied'; reason: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }
  | { type: 'upload-started'; recordingId: string }
  | { type: 'upload-progress'; progress: number }
  | { type: 'upload-finished' }
  | { type: 'fail'; reason: string; retryable: boolean }
  | { type: 'reset' };

const INITIAL_STATE: RecordingMachineState = { kind: 'idle' };

export function recordingReducer(
  state: RecordingMachineState,
  action: RecordingMachineAction,
): RecordingMachineState {
  switch (action.type) {
    case 'request-consent':
      if (state.kind !== 'idle') return state;
      return { kind: 'requesting-consent' };
    case 'consent-granted': {
      if (state.kind !== 'requesting-consent') return state;
      const next: RecordingMachineState = {
        kind: 'recording',
        startedAt: Date.now(),
        ...(action.deviceName !== undefined ? { deviceName: action.deviceName } : {}),
      };
      return next;
    }
    case 'consent-denied':
      if (state.kind !== 'requesting-consent') return state;
      return { kind: 'error', reason: action.reason, retryable: true };
    case 'pause':
      if (state.kind !== 'recording') return state;
      return { kind: 'paused', startedAt: state.startedAt, pausedAt: Date.now() };
    case 'resume':
      if (state.kind !== 'paused') return state;
      return { kind: 'recording', startedAt: state.startedAt };
    case 'stop':
      if (state.kind !== 'recording' && state.kind !== 'paused') return state;
      return { kind: 'stopping' };
    case 'upload-started':
      if (state.kind !== 'stopping') return state;
      return { kind: 'uploading', recordingId: action.recordingId, progress: 0 };
    case 'upload-progress':
      if (state.kind !== 'uploading') return state;
      return { ...state, progress: clampProgress(action.progress) };
    case 'upload-finished':
      if (state.kind !== 'uploading') return state;
      return { kind: 'idle' };
    case 'fail':
      return { kind: 'error', reason: action.reason, retryable: action.retryable };
    case 'reset':
      return INITIAL_STATE;
    default: {
      // Exhaustiveness — TS errors here if a new action lacks a handler.
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export interface RecordingMachine {
  state: RecordingMachineState;
  requestConsent: () => void;
  grantConsent: (deviceName?: string) => void;
  denyConsent: (reason: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  startUpload: (recordingId: string) => void;
  reportProgress: (progress: number) => void;
  finishUpload: () => void;
  fail: (reason: string, retryable?: boolean) => void;
  reset: () => void;
}

export function useRecordingStateMachine(
  initial: RecordingMachineState = INITIAL_STATE,
): RecordingMachine {
  const [state, dispatch] = useReducer(recordingReducer, initial);

  const requestConsent = useCallback(() => dispatch({ type: 'request-consent' }), []);
  const grantConsent = useCallback(
    (deviceName?: string) =>
      dispatch(
        deviceName !== undefined
          ? { type: 'consent-granted', deviceName }
          : { type: 'consent-granted' },
      ),
    [],
  );
  const denyConsent = useCallback(
    (reason: string) => dispatch({ type: 'consent-denied', reason }),
    [],
  );
  const pause = useCallback(() => dispatch({ type: 'pause' }), []);
  const resume = useCallback(() => dispatch({ type: 'resume' }), []);
  const stop = useCallback(() => dispatch({ type: 'stop' }), []);
  const startUpload = useCallback(
    (recordingId: string) => dispatch({ type: 'upload-started', recordingId }),
    [],
  );
  const reportProgress = useCallback(
    (progress: number) => dispatch({ type: 'upload-progress', progress }),
    [],
  );
  const finishUpload = useCallback(() => dispatch({ type: 'upload-finished' }), []);
  const fail = useCallback(
    (reason: string, retryable = true) => dispatch({ type: 'fail', reason, retryable }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return {
    state,
    requestConsent,
    grantConsent,
    denyConsent,
    pause,
    resume,
    stop,
    startUpload,
    reportProgress,
    finishUpload,
    fail,
    reset,
  };
}
