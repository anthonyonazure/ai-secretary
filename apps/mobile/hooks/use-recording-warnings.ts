/**
 * `deriveRecordingWarnings` — composite "what's wrong with this capture"
 * derivation used by the recording surface to decide which inline
 * banners to render in priority order.
 *
 * Higher-priority warnings shadow lower-priority ones — e.g., a denied
 * mic permission supersedes a low-disk-space hint.
 */

export type RecordingWarningKind =
  | 'mic-denied'
  | 'mic-restricted'
  | 'storage-low'
  | 'background-disabled'
  | 'consent-not-acknowledged'
  | 'cellular-data-warning'
  | 'battery-low';

export type RecordingWarningInput = {
  micPermission: 'granted' | 'denied' | 'restricted' | 'unknown';
  freeDiskBytes: number;
  estimatedRecordingBytes: number;
  isBackgroundCaptureEnabled: boolean;
  hasConsentAck: boolean;
  isOnCellular: boolean;
  cellularUploadAllowed: boolean;
  batteryPercent: number | null;
};

export type RecordingWarningResult = {
  warnings: ReadonlyArray<{
    kind: RecordingWarningKind;
    severity: 'error' | 'warning' | 'info';
    copy: string;
    blocksRecording: boolean;
  }>;
  canStartRecording: boolean;
};

const STORAGE_HEADROOM_BYTES = 200 * 1024 * 1024; // 200 MB
const BATTERY_LOW_PCT = 15;

export const deriveRecordingWarnings = (input: RecordingWarningInput): RecordingWarningResult => {
  const out: RecordingWarningResult['warnings'][number][] = [];

  if (input.micPermission === 'denied') {
    out.push({
      kind: 'mic-denied',
      severity: 'error',
      copy: 'Microphone access is denied. Enable it in settings to record.',
      blocksRecording: true,
    });
  } else if (input.micPermission === 'restricted') {
    out.push({
      kind: 'mic-restricted',
      severity: 'error',
      copy: 'Microphone access is restricted on this device.',
      blocksRecording: true,
    });
  }

  if (!input.hasConsentAck) {
    out.push({
      kind: 'consent-not-acknowledged',
      severity: 'error',
      copy: 'Acknowledge the disclosure before recording.',
      blocksRecording: true,
    });
  }

  if (input.freeDiskBytes < Math.max(STORAGE_HEADROOM_BYTES, input.estimatedRecordingBytes * 1.2)) {
    out.push({
      kind: 'storage-low',
      severity: 'warning',
      copy: 'Storage is low — your recording may be cut short.',
      blocksRecording: false,
    });
  }

  if (!input.isBackgroundCaptureEnabled) {
    out.push({
      kind: 'background-disabled',
      severity: 'warning',
      copy: 'Background capture is off — leaving the app may stop the recording.',
      blocksRecording: false,
    });
  }

  if (input.isOnCellular && !input.cellularUploadAllowed) {
    out.push({
      kind: 'cellular-data-warning',
      severity: 'info',
      copy: 'On cellular — upload will resume when you’re on Wi-Fi.',
      blocksRecording: false,
    });
  }

  if (input.batteryPercent !== null && input.batteryPercent <= BATTERY_LOW_PCT) {
    out.push({
      kind: 'battery-low',
      severity: 'warning',
      copy: 'Battery is low. Plug in to avoid losing the recording.',
      blocksRecording: false,
    });
  }

  return {
    warnings: out,
    canStartRecording: !out.some((w) => w.blocksRecording),
  };
};
