/// <reference lib="dom" />

import type { Invite } from '@aisecretary/shared/schemas/invites';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InviteList } from './invite-list';

const baseInvite: Invite = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'pending@acme.test',
  role: 'org_member',
  invitedBy: { userId: '00000000-0000-4000-8000-000000000099', name: 'Admin User' },
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  acceptedAt: null,
  revokedAt: null,
  createdAt: new Date().toISOString(),
};

describe('InviteList (Story 1.5d)', () => {
  it('renders the empty state when there are no invites', () => {
    render(<InviteList invites={[]} />);
    expect(screen.getByTestId('invite-list-empty')).toBeInTheDocument();
  });

  it('renders pending state and revoke button on a pending invite', () => {
    const onRevoke = vi.fn();
    render(<InviteList invites={[baseInvite]} onRevoke={onRevoke} />);
    expect(screen.getByText(/pending@acme.test/i)).toBeInTheDocument();
    expect(screen.getByTestId(`invite-state-${baseInvite.id}`)).toHaveTextContent(/pending/i);
    expect(screen.getByTestId(`invite-revoke-${baseInvite.id}`)).toBeInTheDocument();
  });

  it('hides the revoke button on accepted/revoked/expired invites', () => {
    const accepted = { ...baseInvite, id: 'a', acceptedAt: new Date().toISOString() };
    const revoked = { ...baseInvite, id: 'b', revokedAt: new Date().toISOString() };
    const expired = {
      ...baseInvite,
      id: 'c',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    render(<InviteList invites={[accepted, revoked, expired]} onRevoke={() => undefined} />);
    expect(screen.queryByTestId('invite-revoke-a')).toBeNull();
    expect(screen.queryByTestId('invite-revoke-b')).toBeNull();
    expect(screen.queryByTestId('invite-revoke-c')).toBeNull();
  });

  it('invokes onRevoke when the revoke button is clicked (with confirm)', () => {
    const onRevoke = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<InviteList invites={[baseInvite]} onRevoke={onRevoke} />);
    fireEvent.click(screen.getByTestId(`invite-revoke-${baseInvite.id}`));
    expect(onRevoke).toHaveBeenCalledWith(baseInvite.id);
    confirmSpy.mockRestore();
  });

  it('does NOT call onRevoke when the user cancels the confirm', () => {
    const onRevoke = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<InviteList invites={[baseInvite]} onRevoke={onRevoke} />);
    fireEvent.click(screen.getByTestId(`invite-revoke-${baseInvite.id}`));
    expect(onRevoke).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
