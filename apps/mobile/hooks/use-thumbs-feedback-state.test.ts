import { describe, expect, it } from 'vitest';

import { deriveThumbsFeedbackState } from './use-thumbs-feedback-state.js';

describe('deriveThumbsFeedbackState', () => {
  it('shows the prompt during the polish window', () => {
    const r = deriveThumbsFeedbackState({
      meetingId: 'm-1',
      pendingState: 'unset',
      history: [],
      receiptCountForUser: 12,
      isPolishWindow: true,
    });
    expect(r.showPrompt).toBe(true);
    expect(r.copy).toBe('Was this receipt helpful?');
  });

  it('shows the prompt for the first three receipts even outside polish', () => {
    const r = deriveThumbsFeedbackState({
      meetingId: 'm-1',
      pendingState: 'unset',
      history: [],
      receiptCountForUser: 2,
      isPolishWindow: false,
    });
    expect(r.showPrompt).toBe(true);
  });

  it('hides the prompt after polish + the third receipt', () => {
    const r = deriveThumbsFeedbackState({
      meetingId: 'm-1',
      pendingState: 'unset',
      history: [],
      receiptCountForUser: 8,
      isPolishWindow: false,
    });
    expect(r.showPrompt).toBe(false);
    expect(r.copy).toBe('');
  });

  it('hides the prompt and reports submitted state once history exists', () => {
    const r = deriveThumbsFeedbackState({
      meetingId: 'm-1',
      pendingState: 'unset',
      history: [{ meetingId: 'm-1', state: 'up', submittedAtMs: 1_700_000_000_000 }],
      receiptCountForUser: 1,
      isPolishWindow: true,
    });
    expect(r.submitted).toBe(true);
    expect(r.showPrompt).toBe(false);
    expect(r.copy).toBe('Thanks for the feedback.');
  });

  it('shows the follow-up prompt only on a thumbs-down submission', () => {
    const r = deriveThumbsFeedbackState({
      meetingId: 'm-1',
      pendingState: 'unset',
      history: [{ meetingId: 'm-1', state: 'down', submittedAtMs: 1_700_000_000_000 }],
      receiptCountForUser: 4,
      isPolishWindow: false,
    });
    expect(r.showFollowUp).toBe(true);
    expect(r.copy).toMatch(/what could we do better/);
  });

  it('does not show follow-up on a thumbs-up submission', () => {
    const r = deriveThumbsFeedbackState({
      meetingId: 'm-1',
      pendingState: 'unset',
      history: [{ meetingId: 'm-1', state: 'up', submittedAtMs: 1_700_000_000_000 }],
      receiptCountForUser: 4,
      isPolishWindow: false,
    });
    expect(r.showFollowUp).toBe(false);
  });
});
