/// <reference lib="dom" />

import type { InviteLookupResponse } from '@aisecretary/shared/schemas/invites';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AcceptInviteForm } from './accept-invite-form';

const lookup: InviteLookupResponse = {
  email: 'newmember@acme.test',
  tenantName: 'Acme Inc',
  inviterName: 'Admin User',
  role: 'org_member',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

describe('AcceptInviteForm (Story 1.5d)', () => {
  it('renders the invite metadata above the form', () => {
    render(<AcceptInviteForm lookup={lookup} token="t-token" onSubmit={async () => undefined} />);
    // Acme Inc appears in both the metadata block AND the submit
    // button label ("Join Acme Inc"); both render paths are
    // expected. Assert at least one match.
    expect(screen.getAllByText(/Acme Inc/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Admin User/i)).toBeInTheDocument();
    expect(screen.getByText(/newmember@acme.test/i)).toBeInTheDocument();
  });

  it('submits name + password + token through to onSubmit', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<AcceptInviteForm lookup={lookup} token="t-token" onSubmit={onSubmit} />);

    fireEvent.input(screen.getByLabelText(/your name/i), { target: { value: 'New User' } });
    fireEvent.input(screen.getByLabelText(/password/i), {
      target: { value: 'long-enough-password' },
    });
    fireEvent.click(screen.getByTestId('accept-invite-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      token: 't-token',
      name: 'New User',
      password: 'long-enough-password',
    });
  });

  it('blocks short password submission', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<AcceptInviteForm lookup={lookup} token="t-token" onSubmit={onSubmit} />);
    fireEvent.input(screen.getByLabelText(/your name/i), { target: { value: 'X' } });
    fireEvent.input(screen.getByLabelText(/password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByTestId('accept-invite-submit'));
    await waitFor(() => {
      expect(screen.getByText(/at least 12 characters/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
