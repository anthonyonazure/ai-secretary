import { describe, expect, it } from 'vitest';

import { deriveShareRecipientState } from './use-share-recipient-state.js';

describe('deriveShareRecipientState', () => {
  it('returns "loading" while the fetch is inflight', () => {
    const r = deriveShareRecipientState({ isLoading: true, share: null });
    expect(r.kind).toBe('loading');
  });

  it('returns "expired" with a generic reason when share is null', () => {
    const r = deriveShareRecipientState({ isLoading: false, share: null });
    expect(r.kind).toBe('expired');
    expect(r.reason).toMatch(/invalid or has expired/);
  });

  it('returns "expired" with a "revoked" reason when revokedAt is set', () => {
    const r = deriveShareRecipientState({
      isLoading: false,
      share: {
        expiresAt: '2026-12-01T00:00:00Z',
        revokedAt: '2026-04-29T10:00:00Z',
        blockedAt: null,
        kind: 'meeting',
      },
    });
    expect(r.kind).toBe('expired');
    expect(r.reason).toMatch(/revoked/);
    expect(r.shareKind).toBe('meeting');
  });

  it('returns "blocked-by-policy" when blockedAt is set', () => {
    const r = deriveShareRecipientState({
      isLoading: false,
      share: {
        expiresAt: '2026-12-01T00:00:00Z',
        revokedAt: null,
        blockedAt: '2026-04-29T10:00:00Z',
        kind: 'meeting',
      },
    });
    expect(r.kind).toBe('blocked-by-policy');
    expect(r.reason).toMatch(/blocked cross-org/);
  });

  it('returns "expired" when expiresAt is in the past', () => {
    const r = deriveShareRecipientState({
      isLoading: false,
      share: {
        expiresAt: '2026-04-01T00:00:00Z',
        revokedAt: null,
        blockedAt: null,
        kind: 'meeting',
      },
      now: new Date('2026-04-30T00:00:00Z').getTime(),
    });
    expect(r.kind).toBe('expired');
    expect(r.reason).toMatch(/This link has expired/);
  });

  it('returns "visible" when share is current', () => {
    const r = deriveShareRecipientState({
      isLoading: false,
      share: {
        expiresAt: '2026-12-01T00:00:00Z',
        revokedAt: null,
        blockedAt: null,
        kind: 'clip',
      },
      now: new Date('2026-04-30T00:00:00Z').getTime(),
    });
    expect(r.kind).toBe('visible');
    expect(r.shareKind).toBe('clip');
  });
});
