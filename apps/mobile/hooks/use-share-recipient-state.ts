/**
 * `useShareRecipientState` — pure helpers for the auth-free
 * share-recipient view (Story 8.3 substrate, mobile / WebView fork).
 *
 * The recipient lands on a token URL like
 * `https://app.aisecretary.app/share/<token>`. The native app catches
 * the deep link and navigates to its `ShareRecipientScreen`. Before
 * rendering, we derive the visibility state from the share row:
 *
 *   - `'loading'` — fetch in flight
 *   - `'expired'` — token expired or share revoked (renders the
 *                   plain-language "this link no longer works" page)
 *   - `'blocked-by-policy'` — receiving tenant blocked the share
 *   - `'visible'` — render the recipient view
 *
 * The share kind drives the rendered surface:
 *   - `'meeting'`  — full transcript + analysis cards
 *   - `'clip'`     — narrowed transcript spans + a clip-only player
 *   - `'insight'`  — single insight card from a specific module
 *   - `'token-url'` — meeting-level read for unauthenticated viewers
 */

export type ShareRecipientStateKind = 'loading' | 'expired' | 'blocked-by-policy' | 'visible';

export interface ShareRecipientStateInput {
  isLoading: boolean;
  /** Share row, or null if fetch returned 404 / 410. */
  share: {
    expiresAt: string;
    revokedAt: string | null;
    blockedAt: string | null;
    kind: 'meeting' | 'clip' | 'insight' | 'token-url';
  } | null;
  now?: number;
}

export interface ShareRecipientState {
  kind: ShareRecipientStateKind;
  shareKind: 'meeting' | 'clip' | 'insight' | 'token-url' | null;
  reason: string | null;
}

export const deriveShareRecipientState = (input: ShareRecipientStateInput): ShareRecipientState => {
  if (input.isLoading) {
    return { kind: 'loading', shareKind: null, reason: null };
  }
  if (!input.share) {
    return {
      kind: 'expired',
      shareKind: null,
      reason: 'This link is invalid or has expired.',
    };
  }
  const now = input.now ?? Date.now();
  if (input.share.revokedAt) {
    return {
      kind: 'expired',
      shareKind: input.share.kind,
      reason: 'The sender has revoked this link.',
    };
  }
  if (input.share.blockedAt) {
    return {
      kind: 'blocked-by-policy',
      shareKind: input.share.kind,
      reason: 'Your organization has blocked cross-org shares from this sender.',
    };
  }
  const exp = new Date(input.share.expiresAt).getTime();
  if (Number.isFinite(exp) && exp <= now) {
    return {
      kind: 'expired',
      shareKind: input.share.kind,
      reason: 'This link has expired.',
    };
  }
  return {
    kind: 'visible',
    shareKind: input.share.kind,
    reason: null,
  };
};
