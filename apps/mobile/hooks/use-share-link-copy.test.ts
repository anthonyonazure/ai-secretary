import { describe, expect, it } from 'vitest';

import { deriveShareLinkCopyState } from './use-share-link-copy.js';

const baseInput = {
  link: 'https://aisecretary.app/share/abc',
  copiedAtMs: null,
  errorAtMs: null,
  errorMessage: null,
};

describe('deriveShareLinkCopyState', () => {
  it('shows the idle "Copy link" button when a link is available', () => {
    const r = deriveShareLinkCopyState(baseInput);
    expect(r.buttonLabel).toBe('Copy link');
    expect(r.buttonEnabled).toBe(true);
  });

  it('disables the button when no link is available yet', () => {
    const r = deriveShareLinkCopyState({ ...baseInput, link: null });
    expect(r.buttonEnabled).toBe(false);
  });

  it('shows "Copied!" inside the 2-second confirmation window', () => {
    const now = 1_700_000_000_000;
    const r = deriveShareLinkCopyState({
      ...baseInput,
      copiedAtMs: now - 500,
      now,
    });
    expect(r.buttonLabel).toBe('Copied!');
    expect(r.showConfirmation).toBe(true);
    expect(r.buttonEnabled).toBe(false);
  });

  it('returns to idle once the confirmation window elapses', () => {
    const now = 1_700_000_000_000;
    const r = deriveShareLinkCopyState({
      ...baseInput,
      copiedAtMs: now - 5_000,
      now,
    });
    expect(r.buttonLabel).toBe('Copy link');
    expect(r.showConfirmation).toBe(false);
  });

  it('shows "Try again" + error inside the error window', () => {
    const now = 1_700_000_000_000;
    const r = deriveShareLinkCopyState({
      ...baseInput,
      errorAtMs: now - 1_000,
      errorMessage: 'Clipboard write blocked.',
      now,
    });
    expect(r.buttonLabel).toBe('Try again');
    expect(r.showError).toBe(true);
    expect(r.errorCopy).toContain('Clipboard');
  });

  it('falls back to a default error message when none is provided', () => {
    const now = 1_700_000_000_000;
    const r = deriveShareLinkCopyState({
      ...baseInput,
      errorAtMs: now - 500,
      now,
    });
    expect(r.errorCopy).toMatch(/long-press/i);
  });

  it('error supersedes confirmation if both are active', () => {
    const now = 1_700_000_000_000;
    const r = deriveShareLinkCopyState({
      ...baseInput,
      copiedAtMs: now - 100,
      errorAtMs: now - 200,
      now,
    });
    expect(r.showError).toBe(true);
    expect(r.showConfirmation).toBe(false);
  });
});
