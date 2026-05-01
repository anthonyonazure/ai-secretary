import { describe, expect, it } from 'vitest';

import { deriveRecordingExportModal } from './use-recording-export-modal.js';

const baseInput = {
  selectedFormats: [],
  isClinicalVertical: false,
  isPreparingJob: false,
  jobId: null,
  presignedUrls: [],
  errorMessage: null,
};

describe('deriveRecordingExportModal', () => {
  it('starts at pick-formats with all formats available', () => {
    const r = deriveRecordingExportModal(baseInput);
    expect(r.step).toBe('pick-formats');
    expect(r.availableFormats).toContain('mp3');
    expect(r.availableFormats).toContain('transcript-srt');
    expect(r.canSubmit).toBe(false);
  });

  it('blocks raw-audio formats on clinical verticals', () => {
    const r = deriveRecordingExportModal({ ...baseInput, isClinicalVertical: true });
    expect(r.availableFormats).not.toContain('mp3');
    expect(r.availableFormats).toContain('transcript-vtt');
    expect(r.blockedFormats.some((b) => b.format === 'mp3')).toBe(true);
  });

  it('enables submit when at least one allowed format is selected', () => {
    const r = deriveRecordingExportModal({
      ...baseInput,
      selectedFormats: ['transcript-srt'],
    });
    expect(r.canSubmit).toBe(true);
  });

  it('disables submit when a blocked format is selected', () => {
    const r = deriveRecordingExportModal({
      ...baseInput,
      isClinicalVertical: true,
      selectedFormats: ['mp3'],
    });
    expect(r.canSubmit).toBe(false);
  });

  it('shows preparing while job is in flight', () => {
    const r = deriveRecordingExportModal({
      ...baseInput,
      selectedFormats: ['mp3'],
      isPreparingJob: true,
    });
    expect(r.step).toBe('preparing');
    expect(r.primaryCopy).toMatch(/Preparing/);
  });

  it('shows ready with the right copy on a single export', () => {
    const r = deriveRecordingExportModal({
      ...baseInput,
      jobId: 'job-1',
      presignedUrls: [{ format: 'mp3', url: 'https://example.com/a.mp3' }],
    });
    expect(r.step).toBe('ready');
    expect(r.primaryCopy).toMatch(/export is ready/);
  });

  it('pluralizes copy when multiple exports are ready', () => {
    const r = deriveRecordingExportModal({
      ...baseInput,
      jobId: 'job-1',
      presignedUrls: [
        { format: 'mp3', url: 'a' },
        { format: 'transcript-srt', url: 'b' },
      ],
    });
    expect(r.primaryCopy).toMatch(/2 exports are ready/);
  });

  it('routes errors to the error step', () => {
    const r = deriveRecordingExportModal({
      ...baseInput,
      errorMessage: 'Quota exceeded.',
    });
    expect(r.step).toBe('error');
    expect(r.primaryCopy).toBe('Quota exceeded.');
  });
});
