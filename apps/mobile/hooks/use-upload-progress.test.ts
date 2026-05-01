import { describe, expect, it } from 'vitest';

import { deriveUploadProgress } from './use-upload-progress.js';

describe('deriveUploadProgress', () => {
  it('returns "fresh" for an in-progress upload with no retry', () => {
    const r = deriveUploadProgress({
      bytesUploaded: 250 * 1024,
      bytesTotal: 1000 * 1024,
      retryStartMs: null,
    });
    expect(r.variant).toBe('fresh');
    expect(r.percent).toBe(25);
    expect(r.label).toBe('250 KB / 1000 KB · 25%');
    expect(r.hint).toBe('');
  });

  it('returns "done" when the upload completes', () => {
    const r = deriveUploadProgress({
      bytesUploaded: 1000 * 1024,
      bytesTotal: 1000 * 1024,
      retryStartMs: null,
    });
    expect(r.variant).toBe('done');
    expect(r.percent).toBe(100);
  });

  it('returns "retrying" with a network-class hint while retrying', () => {
    const now = 1_700_000_000_000;
    const r = deriveUploadProgress({
      bytesUploaded: 250 * 1024,
      bytesTotal: 1000 * 1024,
      retryStartMs: now - 60_000,
      networkClass: 'offline',
      now,
    });
    expect(r.variant).toBe('retrying');
    expect(r.hint).toMatch(/offline/);
  });

  it('escalates after the 10-minute retry budget elapses', () => {
    const now = 1_700_000_000_000;
    const r = deriveUploadProgress({
      bytesUploaded: 250 * 1024,
      bytesTotal: 1000 * 1024,
      retryStartMs: now - 11 * 60 * 1000,
      now,
    });
    expect(r.variant).toBe('escalated');
    expect(r.hint).toMatch(/10 minutes/);
  });

  it('returns "error" when isError is true', () => {
    const r = deriveUploadProgress({
      bytesUploaded: 0,
      bytesTotal: 1000,
      retryStartMs: null,
      isError: true,
    });
    expect(r.variant).toBe('error');
    expect(r.hint).toBe('upload failed');
  });

  it('treats zero-byte total as 0% progress', () => {
    const r = deriveUploadProgress({
      bytesUploaded: 0,
      bytesTotal: 0,
      retryStartMs: null,
    });
    expect(r.percent).toBe(0);
    expect(r.variant).toBe('fresh');
  });

  it('clamps bytesUploaded to bytesTotal', () => {
    const r = deriveUploadProgress({
      bytesUploaded: 2000,
      bytesTotal: 1000,
      retryStartMs: null,
    });
    // The clamp avoids 200% percentages — upload is treated as done.
    expect(r.variant).toBe('done');
  });
});
