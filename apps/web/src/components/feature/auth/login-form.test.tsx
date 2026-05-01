/// <reference lib="dom" />

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthFetchError } from '../../../lib/auth/auth-fetch';
import { LoginForm } from './login-form';

describe('LoginForm (Story 1.5a)', () => {
  it('submits email + password through to onSubmit', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    fireEvent.input(screen.getByLabelText(/email/i), { target: { value: 'jane@acme.test' } });
    fireEvent.input(screen.getByLabelText(/password/i), { target: { value: 'pw' } });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ email: 'jane@acme.test', password: 'pw' });
  });

  it('shows zod email validation error before calling onSubmit', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<LoginForm onSubmit={onSubmit} />);
    fireEvent.input(screen.getByLabelText(/email/i), { target: { value: 'not-an-email' } });
    fireEvent.input(screen.getByLabelText(/password/i), { target: { value: 'pw' } });
    fireEvent.click(screen.getByTestId('login-submit'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders an RFC 7807 server error banner', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(
      <LoginForm
        onSubmit={onSubmit}
        serverError={
          new AuthFetchError('Invalid email or password', 401, {
            title: 'Unauthorized',
            detail: 'Invalid email or password',
            requestId: 'req_login',
          })
        }
      />,
    );
    expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    expect(screen.getByText(/req_login/i)).toBeInTheDocument();
  });

  it('switches to signup when the link is clicked', () => {
    const onSwitch = vi.fn();
    render(<LoginForm onSubmit={async () => undefined} onSwitchToSignup={onSwitch} />);
    fireEvent.click(screen.getByText(/create an account/i));
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });
});
