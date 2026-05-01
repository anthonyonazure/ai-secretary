import { describe, expect, it } from 'vitest';

import { deriveClipShareState } from './use-clip-share-state.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe('deriveClipShareState', () => {
  it('describes an org-internal share by recipient count', () => {
    const r = deriveClipShareState({
      scope: 'org-internal',
      expiresAt: null,
      recipientCount: 3,
      blockedByPolicy: false,
    });
    expect(r.label).toBe('org-internal');
    expect(r.copy).toBe('Shared with 3 teammates.');
  });

  it('singularizes the org-internal copy at one teammate', () => {
    const r = deriveClipShareState({
      scope: 'org-internal',
      expiresAt: null,
      recipientCount: 1,
      blockedByPolicy: false,
    });
    expect(r.copy).toBe('Shared with 1 teammate.');
  });

  it('marks a token link expired when its expiration has passed', () => {
    const now = 1_700_000_000_000;
    const r = deriveClipShareState({
      scope: 'token-link',
      expiresAt: new Date(now - ONE_DAY_MS).toISOString(),
      recipientCount: 0,
      blockedByPolicy: false,
      now,
    });
    expect(r.label).toBe('token-link-expired');
    expect(r.showRequestNewLink).toBe(true);
  });

  it('reports days-left for an active token link', () => {
    const now = 1_700_000_000_000;
    const r = deriveClipShareState({
      scope: 'token-link',
      expiresAt: new Date(now + 5 * ONE_DAY_MS).toISOString(),
      recipientCount: 0,
      blockedByPolicy: false,
      now,
    });
    expect(r.label).toBe('token-link-active');
    expect(r.copy).toMatch(/5 days/);
  });

  it('flags a cross-org share blocked by recipient policy', () => {
    const r = deriveClipShareState({
      scope: 'cross-org',
      expiresAt: null,
      recipientCount: 0,
      blockedByPolicy: true,
    });
    expect(r.label).toBe('cross-org-blocked');
    expect(r.showAdminBlockedHint).toBe(true);
  });

  it('shows pending when a cross-org share has zero recipients', () => {
    const r = deriveClipShareState({
      scope: 'cross-org',
      expiresAt: null,
      recipientCount: 0,
      blockedByPolicy: false,
    });
    expect(r.label).toBe('cross-org-pending');
  });

  it('reports accepted-by-N for a cross-org share with recipients', () => {
    const r = deriveClipShareState({
      scope: 'cross-org',
      expiresAt: null,
      recipientCount: 2,
      blockedByPolicy: false,
    });
    expect(r.label).toBe('cross-org-accepted');
    expect(r.copy).toMatch(/2 external recipients/);
  });
});
