import { describe, expect, it } from 'vitest';

import { deriveImportAudioFlow } from './use-import-audio-flow.js';

const baseInput = {
  pickedFile: null,
  isValidating: false,
  isRequestingPresign: false,
  uploadedBytes: 0,
  totalBytes: 0,
  isKickingOff: false,
  meetingId: null,
  errorKind: null,
};

describe('deriveImportAudioFlow', () => {
  it('starts at pick-file with no file picked', () => {
    const r = deriveImportAudioFlow(baseInput);
    expect(r.step).toBe('pick-file');
    expect(r.percent).toBe(0);
  });

  it('moves to validating once a file is picked', () => {
    const r = deriveImportAudioFlow({
      ...baseInput,
      pickedFile: { name: 'meeting.m4a', sizeBytes: 50_000_000, mimeType: 'audio/m4a' },
      isValidating: true,
    });
    expect(r.step).toBe('validating');
  });

  it('flags unsupported file formats', () => {
    const r = deriveImportAudioFlow({
      ...baseInput,
      pickedFile: { name: 'doc.pdf', sizeBytes: 100, mimeType: 'application/pdf' },
    });
    expect(r.step).toBe('error');
    expect(r.errorBanner).toMatch(/format isn’t supported/);
  });

  it('flags files over 2 GB', () => {
    const r = deriveImportAudioFlow({
      ...baseInput,
      pickedFile: {
        name: 'huge.mp4',
        sizeBytes: 3 * 1024 * 1024 * 1024,
        mimeType: 'video/mp4',
      },
    });
    expect(r.step).toBe('error');
    expect(r.errorBanner).toMatch(/2 GB/);
  });

  it('shows uploading progress as a percent', () => {
    const r = deriveImportAudioFlow({
      ...baseInput,
      pickedFile: { name: 'm.m4a', sizeBytes: 100, mimeType: 'audio/m4a' },
      uploadedBytes: 50,
      totalBytes: 100,
    });
    expect(r.step).toBe('uploading');
    expect(r.percent).toBeGreaterThan(0);
    expect(r.percent).toBeLessThanOrEqual(95);
  });

  it('moves to kicking-off after upload completes', () => {
    const r = deriveImportAudioFlow({
      ...baseInput,
      pickedFile: { name: 'm.m4a', sizeBytes: 100, mimeType: 'audio/m4a' },
      uploadedBytes: 100,
      totalBytes: 100,
      isKickingOff: true,
    });
    expect(r.step).toBe('kicking-off-analysis');
    expect(r.percent).toBeGreaterThan(90);
  });

  it('returns done with meetingId set', () => {
    const r = deriveImportAudioFlow({
      ...baseInput,
      meetingId: '00000000-0000-0000-0000-000000000aaa',
    });
    expect(r.step).toBe('done');
    expect(r.percent).toBe(100);
  });

  it('routes a server error to the error step', () => {
    const r = deriveImportAudioFlow({ ...baseInput, errorKind: 'server' });
    expect(r.step).toBe('error');
    expect(r.errorBanner).toMatch(/our side/);
  });

  it('shows requesting-presign label between pick and upload', () => {
    const r = deriveImportAudioFlow({
      ...baseInput,
      pickedFile: { name: 'm.m4a', sizeBytes: 100, mimeType: 'audio/m4a' },
      isRequestingPresign: true,
    });
    expect(r.step).toBe('requesting-presign');
  });
});
