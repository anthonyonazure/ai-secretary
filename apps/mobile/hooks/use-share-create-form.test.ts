import { describe, expect, it } from 'vitest';

import { deriveShareCreateState } from './use-share-create-form.js';

const baseInput = {
  kind: 'meeting' as const,
  recipientEmail: 'teammate@acme.com',
  expiryDays: 30,
  clipStartMs: null,
  clipEndMs: null,
  recordingDurationMs: 30 * 60 * 1000,
  insightModuleId: null,
};

describe('deriveShareCreateState', () => {
  it('allows a basic meeting share with a valid recipient', () => {
    const r = deriveShareCreateState(baseInput);
    expect(r.canSubmit).toBe(true);
    expect(r.blockers).toHaveLength(0);
  });

  it('blocks an empty recipient on a non-token-url share', () => {
    const r = deriveShareCreateState({ ...baseInput, recipientEmail: '' });
    expect(r.blockers).toContain('recipient-required');
  });

  it('flags a malformed email', () => {
    const r = deriveShareCreateState({ ...baseInput, recipientEmail: 'not-an-email' });
    expect(r.blockers).toContain('invalid-email');
  });

  it('skips recipient checks for a token-url share', () => {
    const r = deriveShareCreateState({
      ...baseInput,
      kind: 'token-url',
      recipientEmail: '',
    });
    expect(r.canSubmit).toBe(true);
  });

  it('blocks expiry outside the 1–90 day range', () => {
    expect(deriveShareCreateState({ ...baseInput, expiryDays: 0 }).blockers).toContain(
      'expiry-out-of-range',
    );
    expect(deriveShareCreateState({ ...baseInput, expiryDays: 91 }).blockers).toContain(
      'expiry-out-of-range',
    );
  });

  it('requires bounds for a clip share', () => {
    const r = deriveShareCreateState({ ...baseInput, kind: 'clip' });
    expect(r.blockers).toContain('clip-bounds-invalid');
  });

  it('flags a clip shorter than 5 seconds', () => {
    const r = deriveShareCreateState({
      ...baseInput,
      kind: 'clip',
      clipStartMs: 0,
      clipEndMs: 1_000,
    });
    expect(r.blockers).toContain('clip-too-short');
  });

  it('flags a clip longer than 10 minutes', () => {
    const r = deriveShareCreateState({
      ...baseInput,
      kind: 'clip',
      clipStartMs: 0,
      clipEndMs: 11 * 60 * 1000,
    });
    expect(r.blockers).toContain('clip-too-long');
  });

  it('flags a clip past the recording end', () => {
    const r = deriveShareCreateState({
      ...baseInput,
      kind: 'clip',
      clipStartMs: 0,
      clipEndMs: 31 * 60 * 1000,
    });
    expect(r.blockers).toContain('clip-past-end');
  });

  it('requires an insight module on an insight share', () => {
    const r = deriveShareCreateState({ ...baseInput, kind: 'insight' });
    expect(r.blockers).toContain('insight-module-required');
  });

  it('passes a valid clip share with bounded duration', () => {
    const r = deriveShareCreateState({
      ...baseInput,
      kind: 'clip',
      clipStartMs: 30_000,
      clipEndMs: 90_000,
    });
    expect(r.canSubmit).toBe(true);
    expect(r.durationMs).toBe(60_000);
  });
});
