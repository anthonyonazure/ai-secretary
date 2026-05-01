/**
 * `useRecordButtonState` — mobile record-button derivation.
 *
 * Mirrors the web RecordingStatusPill V2 logic in pure-function form
 * so the mobile test runner (no RN renderer) can exercise it. The
 * native screen consumes the result + maps to the locked-design pill
 * variants.
 *
 * Inputs:
 *   - `recordingFsm` — outer state (`idle | preparing | recording |
 *     paused | uploading | failed`)
 *   - `permissionStatus` — `granted | denied | prompt`
 *   - `consentReady` — boolean (true when the pre-mic consent modal
 *     has been acknowledged for this session)
 *   - `bytesUploaded` / `bytesTotal` — drives the upload-progress label
 *
 * Output:
 *   - `label` — short button text
 *   - `kind`  — visual variant (`primary | warning | muted | danger`)
 *   - `disabled` — when the button shouldn't be interactive
 *   - `cta` — the action the button performs when tapped
 */

export type RecordingFsmState =
  | 'idle'
  | 'preparing'
  | 'recording'
  | 'paused'
  | 'uploading'
  | 'failed';

export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export interface RecordButtonInput {
  recordingFsm: RecordingFsmState;
  permissionStatus: PermissionStatus;
  consentReady: boolean;
  bytesUploaded?: number;
  bytesTotal?: number;
}

export type RecordButtonCta =
  | 'request-permission'
  | 'start-recording'
  | 'pause-recording'
  | 'resume-recording'
  | 'stop-recording'
  | 'retry'
  | 'await-consent';

export interface RecordButtonState {
  label: string;
  kind: 'primary' | 'warning' | 'muted' | 'danger';
  disabled: boolean;
  cta: RecordButtonCta;
}

export const deriveRecordButtonState = (input: RecordButtonInput): RecordButtonState => {
  if (input.permissionStatus === 'denied') {
    return {
      label: 'Mic access denied',
      kind: 'danger',
      disabled: true,
      cta: 'request-permission',
    };
  }
  if (input.permissionStatus === 'prompt') {
    return {
      label: 'Allow microphone',
      kind: 'primary',
      disabled: false,
      cta: 'request-permission',
    };
  }
  if (!input.consentReady) {
    return {
      label: 'Awaiting consent',
      kind: 'muted',
      disabled: true,
      cta: 'await-consent',
    };
  }

  switch (input.recordingFsm) {
    case 'idle':
      return {
        label: 'Record',
        kind: 'primary',
        disabled: false,
        cta: 'start-recording',
      };
    case 'preparing':
      return {
        label: 'Preparing…',
        kind: 'muted',
        disabled: true,
        cta: 'start-recording',
      };
    case 'recording':
      return {
        label: 'Stop',
        kind: 'warning',
        disabled: false,
        cta: 'stop-recording',
      };
    case 'paused':
      return {
        label: 'Resume',
        kind: 'primary',
        disabled: false,
        cta: 'resume-recording',
      };
    case 'uploading': {
      const total = input.bytesTotal ?? 0;
      const uploaded = input.bytesUploaded ?? 0;
      const pct = total === 0 ? 0 : Math.floor((uploaded / total) * 100);
      return {
        label: `Uploading ${pct}%`,
        kind: 'muted',
        disabled: true,
        cta: 'stop-recording',
      };
    }
    case 'failed':
      return {
        label: 'Retry',
        kind: 'danger',
        disabled: false,
        cta: 'retry',
      };
  }
};
