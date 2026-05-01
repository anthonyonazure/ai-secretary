import { describe, expect, it } from 'vitest';

import { deriveCitationTooltipState } from './use-citation-tooltip.js';

const baseInput = {
  isOpen: true,
  hasSnippet: true,
  snippet: 'Acme confirmed budget through Q4.',
  speaker: 'Priya',
  spanStartMs: 92_000,
  isReducedMotion: false,
  isLoading: false,
};

describe('deriveCitationTooltipState', () => {
  it('returns hidden state when tooltip is closed', () => {
    const r = deriveCitationTooltipState({ ...baseInput, isOpen: false });
    expect(r.visible).toBe(false);
  });

  it('renders speaker + timestamp + snippet on open', () => {
    const r = deriveCitationTooltipState(baseInput);
    expect(r.visible).toBe(true);
    expect(r.body).toContain('Priya');
    expect(r.body).toContain('1:32');
    expect(r.body).toContain('Acme confirmed');
  });

  it('shows a loading state with spinner', () => {
    const r = deriveCitationTooltipState({ ...baseInput, isLoading: true });
    expect(r.body).toBe('Loading transcript…');
    expect(r.showSpinner).toBe(true);
  });

  it('falls back to "Speaker" when no speaker is diarized', () => {
    const r = deriveCitationTooltipState({ ...baseInput, speaker: null });
    expect(r.body).toContain('Speaker');
  });

  it('truncates long snippets', () => {
    const r = deriveCitationTooltipState({
      ...baseInput,
      snippet: 'A'.repeat(500),
    });
    expect(r.body.endsWith('…')).toBe(true);
  });

  it('returns no-preview copy when no snippet is available', () => {
    const r = deriveCitationTooltipState({ ...baseInput, hasSnippet: false });
    expect(r.body).toContain('no preview available');
  });

  it('zeroes out fade when reduced-motion is set', () => {
    const r = deriveCitationTooltipState({ ...baseInput, isReducedMotion: true });
    expect(r.fadeMs).toBe(0);
  });

  it('uses default fade when reduced-motion is off', () => {
    const r = deriveCitationTooltipState(baseInput);
    expect(r.fadeMs).toBeGreaterThan(0);
  });
});
