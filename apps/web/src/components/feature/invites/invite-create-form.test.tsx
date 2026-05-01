/// <reference lib="dom" />

import type { CreateInviteRequest } from '@aisecretary/shared/schemas/invites';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InviteCreateForm } from './invite-create-form';

describe('InviteCreateForm (Story 1.5d)', () => {
  it('submits valid input through to onSubmit', async () => {
    const onSubmit = vi.fn<(values: CreateInviteRequest) => Promise<void>>(async () => undefined);
    render(<InviteCreateForm onSubmit={onSubmit} />);

    fireEvent.input(screen.getByLabelText(/email/i), {
      target: { value: 'newmember@acme.test' },
    });
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'org_member' } });
    fireEvent.click(screen.getByTestId('invite-create-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'newmember@acme.test', role: 'org_member' }),
    );
  });

  it('blocks invalid email submission and shows zod error', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<InviteCreateForm onSubmit={onSubmit} />);

    fireEvent.input(screen.getByLabelText(/email/i), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByTestId('invite-create-submit'));

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects ttlDays > 30 via zod', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<InviteCreateForm onSubmit={onSubmit} />);
    fireEvent.input(screen.getByLabelText(/email/i), {
      target: { value: 'a@acme.test' },
    });
    fireEvent.input(screen.getByLabelText(/expires in/i), { target: { value: '99' } });
    fireEvent.click(screen.getByTestId('invite-create-submit'));
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
