import { describe, expect, it } from 'vitest';

import { chatEmptyStateCopy } from './use-chat-empty-state.js';

describe('chatEmptyStateCopy', () => {
  it('returns success emphasis for confident answers', () => {
    const copy = chatEmptyStateCopy('confident');
    expect(copy.emphasis).toBe('success');
    expect(copy.headline).toMatch(/Answer/);
  });

  it('returns warning emphasis + a CTA for low-confidence', () => {
    const copy = chatEmptyStateCopy('low-confidence');
    expect(copy.emphasis).toBe('warning');
    expect(copy.cta).toBeTruthy();
  });

  it('returns honest "I don\'t know" copy for no-answer', () => {
    const copy = chatEmptyStateCopy('no-answer');
    expect(copy.headline).toMatch(/don't know/i);
    expect(copy.cta).toMatch(/Record/);
  });

  it('returns muted emphasis for off-topic', () => {
    const copy = chatEmptyStateCopy('off-topic');
    expect(copy.emphasis).toBe('muted');
    expect(copy.cta).toBe('');
  });

  it('returns "Working on it…" for the pending sentinel', () => {
    const copy = chatEmptyStateCopy('pending');
    expect(copy.headline).toMatch(/Working/);
  });

  it('renders French copy for fr-* locales', () => {
    const copy = chatEmptyStateCopy('no-answer', 'fr-FR');
    expect(copy.headline).toMatch(/sais pas/);
  });
});
