/**
 * Mobile InviteList — pure-logic tests (Story 1.5d).
 *
 * Mirrors the pattern in `components/analysis/citation-chip.test.ts`:
 * the mobile vitest setup runs under node with no react-native
 * renderer, so the visual component is exercised only in Storybook
 * stories. Pure logic — the state-derivation function — is testable
 * without rendering.
 */

import type { Invite } from '@aisecretary/shared/schemas/invites';
import { describe, expect, it } from 'vitest';

type InviteState = 'pending' | 'accepted' | 'revoked' | 'expired';

/**
 * Mirror of `inviteState` inside `invite-list.tsx`. Keep in sync — if
 * the component changes its derivation, update both. The web-side
 * test asserts the same shape via the rendered badge.
 */
const inviteState = (invite: Invite): InviteState => {
  if (invite.acceptedAt) return 'accepted';
  if (invite.revokedAt) return 'revoked';
  if (new Date(invite.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'pending';
};

const baseInvite: Invite = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'pending@acme.test',
  role: 'org_member',
  invitedBy: { userId: '00000000-0000-4000-8000-000000000099', name: 'Admin' },
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  acceptedAt: null,
  revokedAt: null,
  createdAt: new Date().toISOString(),
};

describe('InviteList — state derivation', () => {
  it('classifies a fresh, unaccepted invite as pending', () => {
    expect(inviteState(baseInvite)).toBe('pending');
  });
  it('classifies as accepted when acceptedAt is set', () => {
    expect(inviteState({ ...baseInvite, acceptedAt: new Date().toISOString() })).toBe('accepted');
  });
  it('classifies as revoked when revokedAt is set', () => {
    expect(inviteState({ ...baseInvite, revokedAt: new Date().toISOString() })).toBe('revoked');
  });
  it('classifies as expired when expiresAt is in the past', () => {
    expect(
      inviteState({ ...baseInvite, expiresAt: new Date(Date.now() - 1000).toISOString() }),
    ).toBe('expired');
  });
  it('prefers accepted over revoked when both are set (should not happen in practice)', () => {
    const both = {
      ...baseInvite,
      acceptedAt: new Date().toISOString(),
      revokedAt: new Date().toISOString(),
    };
    expect(inviteState(both)).toBe('accepted');
  });
});
