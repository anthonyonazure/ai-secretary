/**
 * `deriveRecordingExportModal` — derives the modal state for exporting
 * a single recording. The host owns the actual export job kickoff and
 * presigned URL; we render the right step + checklist.
 */

export type RecordingExportFormat = 'mp3' | 'wav' | 'm4a' | 'transcript-srt' | 'transcript-vtt';

export type RecordingExportModalInput = {
  selectedFormats: ReadonlyArray<RecordingExportFormat>;
  isClinicalVertical: boolean;
  isPreparingJob: boolean;
  jobId: string | null;
  presignedUrls: ReadonlyArray<{ format: RecordingExportFormat; url: string }>;
  errorMessage: string | null;
};

export type RecordingExportModalState = {
  step: 'pick-formats' | 'preparing' | 'ready' | 'error';
  availableFormats: ReadonlyArray<RecordingExportFormat>;
  blockedFormats: ReadonlyArray<{ format: RecordingExportFormat; reason: string }>;
  canSubmit: boolean;
  primaryCopy: string;
};

const ALL_FORMATS: ReadonlyArray<RecordingExportFormat> = [
  'mp3',
  'wav',
  'm4a',
  'transcript-srt',
  'transcript-vtt',
];

const RAW_AUDIO: ReadonlySet<RecordingExportFormat> = new Set(['mp3', 'wav', 'm4a']);

export const deriveRecordingExportModal = (
  input: RecordingExportModalInput,
): RecordingExportModalState => {
  if (input.errorMessage) {
    return {
      step: 'error',
      availableFormats: [],
      blockedFormats: [],
      canSubmit: false,
      primaryCopy: input.errorMessage,
    };
  }

  if (input.presignedUrls.length > 0 && input.jobId !== null) {
    return {
      step: 'ready',
      availableFormats: input.presignedUrls.map((u) => u.format),
      blockedFormats: [],
      canSubmit: false,
      primaryCopy:
        input.presignedUrls.length === 1
          ? 'Your export is ready.'
          : `Your ${input.presignedUrls.length} exports are ready.`,
    };
  }

  if (input.isPreparingJob) {
    return {
      step: 'preparing',
      availableFormats: [],
      blockedFormats: [],
      canSubmit: false,
      primaryCopy: 'Preparing your export…',
    };
  }

  const blockedFormats = ALL_FORMATS.flatMap<{ format: RecordingExportFormat; reason: string }>(
    (f) =>
      input.isClinicalVertical && RAW_AUDIO.has(f)
        ? [{ format: f, reason: 'Clinical tenants block raw-audio exports.' }]
        : [],
  );
  const blockedSet = new Set(blockedFormats.map((b) => b.format));
  const available = ALL_FORMATS.filter((f) => !blockedSet.has(f));
  const validSelection =
    input.selectedFormats.length > 0 && input.selectedFormats.every((f) => !blockedSet.has(f));

  return {
    step: 'pick-formats',
    availableFormats: available,
    blockedFormats,
    canSubmit: validSelection,
    primaryCopy: 'Pick the formats you want to export.',
  };
};
