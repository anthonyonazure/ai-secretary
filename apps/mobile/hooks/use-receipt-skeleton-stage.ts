export type ReceiptStage =
  | 'idle'
  | 'capturing'
  | 'uploading'
  | 'transcribing'
  | 'summarizing'
  | 'analyzing'
  | 'ready'
  | 'failed';

export type ReceiptStageInput = {
  hasRecording: boolean;
  uploadedAtMs: number | null;
  transcriptCompletedAtMs: number | null;
  summaryCompletedAtMs: number | null;
  analysisCompletedAtMs: number | null;
  failureKind: 'transcription' | 'summary' | 'analysis' | null;
  isCapturing: boolean;
  now?: number;
};

export type ReceiptStageResult = {
  stage: ReceiptStage;
  label: string;
  progress: number;
  ariaBusy: boolean;
};

export const deriveReceiptSkeletonStage = (input: ReceiptStageInput): ReceiptStageResult => {
  if (input.failureKind !== null) {
    return {
      stage: 'failed',
      label:
        input.failureKind === 'transcription'
          ? 'Transcription failed.'
          : input.failureKind === 'summary'
            ? 'Summary failed.'
            : 'Analysis failed.',
      progress: 0,
      ariaBusy: false,
    };
  }
  if (input.analysisCompletedAtMs !== null) {
    return { stage: 'ready', label: 'Ready', progress: 1, ariaBusy: false };
  }
  if (input.summaryCompletedAtMs !== null) {
    return {
      stage: 'analyzing',
      label: 'Running module analysis…',
      progress: 0.85,
      ariaBusy: true,
    };
  }
  if (input.transcriptCompletedAtMs !== null) {
    return {
      stage: 'summarizing',
      label: 'Summarizing receipt…',
      progress: 0.65,
      ariaBusy: true,
    };
  }
  if (input.uploadedAtMs !== null) {
    return {
      stage: 'transcribing',
      label: 'Transcribing audio…',
      progress: 0.4,
      ariaBusy: true,
    };
  }
  if (input.hasRecording) {
    return {
      stage: 'uploading',
      label: 'Uploading recording…',
      progress: 0.2,
      ariaBusy: true,
    };
  }
  if (input.isCapturing) {
    return {
      stage: 'capturing',
      label: 'Capturing audio…',
      progress: 0.05,
      ariaBusy: true,
    };
  }
  return { stage: 'idle', label: '', progress: 0, ariaBusy: false };
};
