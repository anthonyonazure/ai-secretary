import { describe, expect, it } from 'vitest';

import { deriveActionItemEditState } from './use-action-item-edit-state.js';

const baseInput = {
  draftTitle: 'Send security pack',
  draftOwnerUserId: 'u-1',
  draftDueDate: '2026-05-04',
  originalTitle: 'Send security pack',
  originalOwnerUserId: 'u-1',
  originalDueDate: '2026-05-04',
  isSubmitting: false,
  serverError: null,
};

describe('deriveActionItemEditState', () => {
  it('reports no unsaved changes when draft matches original', () => {
    const r = deriveActionItemEditState(baseInput);
    expect(r.hasUnsavedChanges).toBe(false);
    expect(r.canSave).toBe(false);
  });

  it('detects unsaved changes when the title is edited', () => {
    const r = deriveActionItemEditState({ ...baseInput, draftTitle: 'Send updated security pack' });
    expect(r.hasUnsavedChanges).toBe(true);
    expect(r.canSave).toBe(true);
  });

  it('detects unsaved changes on owner reassignment', () => {
    const r = deriveActionItemEditState({ ...baseInput, draftOwnerUserId: 'u-2' });
    expect(r.hasUnsavedChanges).toBe(true);
  });

  it('blocks save with empty-title when the title is whitespace-only', () => {
    const r = deriveActionItemEditState({
      ...baseInput,
      draftTitle: '   ',
      originalTitle: 'something',
    });
    expect(r.canSave).toBe(false);
    expect(r.blocker).toBe('empty-title');
  });

  it('blocks save with empty-title past the max length', () => {
    const longTitle = 'x'.repeat(281);
    const r = deriveActionItemEditState({
      ...baseInput,
      draftTitle: longTitle,
    });
    expect(r.canSave).toBe(false);
    expect(r.blocker).toBe('empty-title');
  });

  it('blocks save while submitting is in flight', () => {
    const r = deriveActionItemEditState({
      ...baseInput,
      draftTitle: 'New title',
      isSubmitting: true,
    });
    expect(r.canSave).toBe(false);
    expect(r.blocker).toBe('submitting');
  });

  it('passes a server error through to the banner', () => {
    const r = deriveActionItemEditState({
      ...baseInput,
      serverError: 'Network error — please try again.',
    });
    expect(r.errorBanner).toBe('Network error — please try again.');
  });

  it('treats null due-date changes as a real edit', () => {
    const r = deriveActionItemEditState({
      ...baseInput,
      draftDueDate: null,
      originalDueDate: '2026-05-04',
    });
    expect(r.hasUnsavedChanges).toBe(true);
  });
});
