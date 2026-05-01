/**
 * `deriveImportAudioFlow` — Story 4.4 import-audio wizard state.
 *
 * The user picks a file → we validate format + size → server presigns
 * → upload → analyzes → routes to receipt. This pure helper renders
 * the right step + error / progress label based on a flat input shape.
 */

export type ImportAudioStep =
  | 'pick-file'
  | 'validating'
  | 'requesting-presign'
  | 'uploading'
  | 'kicking-off-analysis'
  | 'done'
  | 'error';

export type ImportAudioInput = {
  pickedFile: { name: string; sizeBytes: number; mimeType: string } | null;
  isValidating: boolean;
  isRequestingPresign: boolean;
  uploadedBytes: number;
  totalBytes: number;
  isKickingOff: boolean;
  meetingId: string | null;
  errorKind:
    | 'unsupported-format'
    | 'file-too-large'
    | 'duration-too-long'
    | 'network'
    | 'server'
    | null;
};

export type ImportAudioStepResult = {
  step: ImportAudioStep;
  label: string;
  percent: number;
  errorBanner: string | null;
  doneAt: string | null;
};

const ALLOWED_MIME_PREFIXES = ['audio/', 'video/'];
const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

const ERROR_COPY: Record<NonNullable<ImportAudioInput['errorKind']>, string> = {
  'unsupported-format': 'That file format isn’t supported. Try MP3, M4A, or MP4.',
  'file-too-large': 'File is over 2 GB. Trim it or use a faster compressor.',
  'duration-too-long': 'Recording is over 4 hours. Split it before uploading.',
  network: 'Network hiccup. Retry the upload.',
  server: 'Something went wrong on our side. Try again in a minute.',
};

export const deriveImportAudioFlow = (input: ImportAudioInput): ImportAudioStepResult => {
  if (input.errorKind) {
    return {
      step: 'error',
      label: ERROR_COPY[input.errorKind],
      percent: 0,
      errorBanner: ERROR_COPY[input.errorKind],
      doneAt: null,
    };
  }

  if (input.meetingId !== null) {
    return {
      step: 'done',
      label: 'Ready — opening your receipt.',
      percent: 100,
      errorBanner: null,
      doneAt: new Date().toISOString(),
    };
  }

  if (input.isKickingOff) {
    return {
      step: 'kicking-off-analysis',
      label: 'Starting transcription…',
      percent: 95,
      errorBanner: null,
      doneAt: null,
    };
  }

  if (input.totalBytes > 0 && input.uploadedBytes > 0) {
    const percent = Math.min(95, Math.round((input.uploadedBytes / input.totalBytes) * 90));
    return {
      step: 'uploading',
      label: 'Uploading…',
      percent,
      errorBanner: null,
      doneAt: null,
    };
  }

  if (input.isRequestingPresign) {
    return {
      step: 'requesting-presign',
      label: 'Preparing upload…',
      percent: 5,
      errorBanner: null,
      doneAt: null,
    };
  }

  const file = input.pickedFile;
  if (file !== null) {
    if (!ALLOWED_MIME_PREFIXES.some((p) => file.mimeType.startsWith(p))) {
      return {
        step: 'error',
        label: ERROR_COPY['unsupported-format'],
        percent: 0,
        errorBanner: ERROR_COPY['unsupported-format'],
        doneAt: null,
      };
    }
    if (file.sizeBytes > MAX_FILE_BYTES) {
      return {
        step: 'error',
        label: ERROR_COPY['file-too-large'],
        percent: 0,
        errorBanner: ERROR_COPY['file-too-large'],
        doneAt: null,
      };
    }
    if (input.isValidating) {
      return {
        step: 'validating',
        label: 'Validating file…',
        percent: 1,
        errorBanner: null,
        doneAt: null,
      };
    }
  }

  return {
    step: 'pick-file',
    label: 'Pick an audio or video file to import.',
    percent: 0,
    errorBanner: null,
    doneAt: null,
  };
};
