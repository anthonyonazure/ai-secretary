import { describe, expect, it } from 'vitest';

import { deriveErasureCascadePreview } from './use-erasure-cascade-preview.js';

const baseInput = {
  subjectEmail: 'subject@example.com',
  tally: [
    { resourceType: 'transcripts', count: 47, strategy: 'cascade' as const },
    { resourceType: 'embeddings', count: 1200, strategy: 'shred' as const },
  ],
  hasTypedConfirm: false,
  typedConfirm: '',
  isCommitting: false,
  errorMessage: null,
};

describe('deriveErasureCascadePreview', () => {
  it('sums tallies into the total count', () => {
    const r = deriveErasureCascadePreview(baseInput);
    expect(r.totalCount).toBe(1247);
    expect(r.primaryCopy).toMatch(/1247 records/);
  });

  it('handles a zero-tally subject', () => {
    const r = deriveErasureCascadePreview({ ...baseInput, tally: [] });
    expect(r.totalCount).toBe(0);
    expect(r.primaryCopy).toMatch(/No data found/);
  });

  it('disables commit when typed confirmation is missing', () => {
    const r = deriveErasureCascadePreview(baseInput);
    expect(r.canCommit).toBe(false);
  });

  it('enables commit when typed confirmation matches "delete <email>"', () => {
    const r = deriveErasureCascadePreview({
      ...baseInput,
      hasTypedConfirm: true,
      typedConfirm: 'delete subject@example.com',
    });
    expect(r.canCommit).toBe(true);
  });

  it('is case-insensitive in the confirm match', () => {
    const r = deriveErasureCascadePreview({
      ...baseInput,
      hasTypedConfirm: true,
      typedConfirm: 'Delete Subject@Example.com',
    });
    expect(r.canCommit).toBe(true);
  });

  it('rejects a mismatched confirm', () => {
    const r = deriveErasureCascadePreview({
      ...baseInput,
      hasTypedConfirm: true,
      typedConfirm: 'erase subject@example.com',
    });
    expect(r.canCommit).toBe(false);
  });

  it('disables commit while a delete is in flight', () => {
    const r = deriveErasureCascadePreview({
      ...baseInput,
      hasTypedConfirm: true,
      typedConfirm: 'delete subject@example.com',
      isCommitting: true,
    });
    expect(r.canCommit).toBe(false);
    expect(r.showSpinner).toBe(true);
  });

  it('renders strategy + count detail lines', () => {
    const r = deriveErasureCascadePreview(baseInput);
    expect(r.detailLines).toEqual([
      'Delete cascaded: 47 transcripts',
      'Shred (overwrite): 1200 embeddings',
    ]);
  });

  it('passes the error banner through', () => {
    const r = deriveErasureCascadePreview({
      ...baseInput,
      errorMessage: 'Network error',
    });
    expect(r.errorBanner).toBe('Network error');
  });
});
