import { describe, expect, it } from 'vitest';

import { deriveInboxState, emptyStateCopy } from './use-inbox-state.js';

describe('deriveInboxState', () => {
  it('returns "loading" while the fetch is in flight', () => {
    expect(deriveInboxState({ isLoading: true, isError: false, meetingCount: 0 })).toBe('loading');
  });

  it('returns "error" when the fetch failed', () => {
    expect(deriveInboxState({ isLoading: false, isError: true, meetingCount: 0 })).toBe('error');
  });

  it('returns "empty-recipient" when zero meetings', () => {
    expect(deriveInboxState({ isLoading: false, isError: false, meetingCount: 0 })).toBe(
      'empty-recipient',
    );
  });

  it('returns "list" when at least one meeting exists', () => {
    expect(deriveInboxState({ isLoading: false, isError: false, meetingCount: 1 })).toBe('list');
  });

  it('prioritises loading over error', () => {
    expect(deriveInboxState({ isLoading: true, isError: true, meetingCount: 0 })).toBe('loading');
  });
});

describe('emptyStateCopy', () => {
  it('renders English copy by default', () => {
    const copy = emptyStateCopy('en-US');
    expect(copy.headline).toMatch(/Welcome/);
  });

  it('renders French copy for fr-* locales', () => {
    const copy = emptyStateCopy('fr-FR');
    expect(copy.headline).toMatch(/Bienvenue/);
  });

  it('falls back to English for unknown locales', () => {
    const copy = emptyStateCopy('xx-YY');
    expect(copy.headline).toMatch(/Welcome/);
  });
});
