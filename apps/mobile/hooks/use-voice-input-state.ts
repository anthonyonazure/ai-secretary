/**
 * `deriveVoiceInputState` — FR62 VoiceInputSurface state derivation.
 *
 * Pure helper for the dictation surface used across SOAP edits, action-item
 * check-off, summary edits, and free-text fields. The native screen wires
 * this to expo-speech-recognition (or a platform-specific equivalent);
 * web wires it to the browser SpeechRecognition API.
 *
 * Three lifecycle pillars:
 *   - permission grant (mic / recognition)
 *   - capture lifecycle (idle / listening / committing / error)
 *   - transcript buffer (interim + final segments)
 */

export type VoiceInputPermission = 'unknown' | 'granted' | 'denied' | 'restricted';

export type VoiceInputStatus =
  | 'idle'
  | 'requesting-permission'
  | 'listening'
  | 'processing'
  | 'error';

export type VoiceInputInput = {
  permission: VoiceInputPermission;
  status: VoiceInputStatus;
  interim: string;
  final: ReadonlyArray<string>;
  isReducedMotion: boolean;
  errorKind: 'network' | 'no-speech' | 'unsupported' | 'aborted' | null;
};

export type VoiceInputState = {
  canStart: boolean;
  canStop: boolean;
  showWaveform: boolean;
  combinedTranscript: string;
  bannerCopy: string | null;
  ariaLive: 'off' | 'polite' | 'assertive';
};

const ERROR_COPY: Record<NonNullable<VoiceInputInput['errorKind']>, string> = {
  network: 'No network — voice input is unavailable.',
  'no-speech': 'Didn’t catch that. Try again.',
  unsupported: 'Voice input isn’t supported on this device.',
  aborted: 'Voice input stopped.',
};

export const deriveVoiceInputState = (input: VoiceInputInput): VoiceInputState => {
  const combinedTranscript = [...input.final, input.interim].filter((s) => s.length > 0).join(' ');

  if (input.permission === 'denied' || input.permission === 'restricted') {
    return {
      canStart: false,
      canStop: false,
      showWaveform: false,
      combinedTranscript,
      bannerCopy: 'Microphone access is required for voice input. Enable it in settings.',
      ariaLive: 'polite',
    };
  }

  if (input.status === 'error') {
    return {
      canStart: input.permission === 'granted',
      canStop: false,
      showWaveform: false,
      combinedTranscript,
      bannerCopy: input.errorKind ? ERROR_COPY[input.errorKind] : 'Something went wrong.',
      ariaLive: 'assertive',
    };
  }

  if (input.status === 'listening') {
    return {
      canStart: false,
      canStop: true,
      showWaveform: !input.isReducedMotion,
      combinedTranscript,
      bannerCopy: null,
      ariaLive: 'polite',
    };
  }

  if (input.status === 'requesting-permission' || input.status === 'processing') {
    return {
      canStart: false,
      canStop: false,
      showWaveform: false,
      combinedTranscript,
      bannerCopy: input.status === 'processing' ? 'Processing…' : 'Requesting microphone…',
      ariaLive: 'polite',
    };
  }

  return {
    canStart: input.permission === 'granted' || input.permission === 'unknown',
    canStop: false,
    showWaveform: false,
    combinedTranscript,
    bannerCopy: null,
    ariaLive: 'off',
  };
};
