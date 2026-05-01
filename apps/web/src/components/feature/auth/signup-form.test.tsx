/// <reference lib="dom" />

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthFetchError } from '../../../lib/auth/auth-fetch';
import { SignupForm } from './signup-form';

describe('SignupForm (Story 1.5a)', () => {
  it('submits valid input through to onSubmit', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<SignupForm onSubmit={onSubmit} />);

    fireEvent.input(screen.getByLabelText(/your name/i), { target: { value: 'Jane Architect' } });
    fireEvent.input(screen.getByLabelText(/workspace name/i), { target: { value: 'Acme Co' } });
    fireEvent.change(screen.getByLabelText(/region/i), { target: { value: 'us' } });
    fireEvent.input(screen.getByLabelText(/work email/i), {
      target: { value: 'jane@acme.test' },
    });
    fireEvent.input(screen.getByLabelText(/password/i), {
      target: { value: 'long-enough-password' },
    });

    fireEvent.click(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      tenantName: 'Acme Co',
      region: 'us',
      email: 'jane@acme.test',
      password: 'long-enough-password',
      name: 'Jane Architect',
    });
  });

  it('blocks submission when password is too short and shows zod message', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<SignupForm onSubmit={onSubmit} />);

    fireEvent.input(screen.getByLabelText(/your name/i), { target: { value: 'Jane' } });
    fireEvent.input(screen.getByLabelText(/workspace name/i), { target: { value: 'Acme' } });
    fireEvent.input(screen.getByLabelText(/work email/i), { target: { value: 'jane@acme.test' } });
    fireEvent.input(screen.getByLabelText(/password/i), { target: { value: 'short' } });

    fireEvent.click(screen.getByTestId('signup-submit'));

    await waitFor(() => {
      expect(screen.getByText(/at least 12 characters/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('maps RFC 7807 server field errors onto the form via setError', async () => {
    const onSubmit = vi.fn(async () => {
      throw new AuthFetchError('Email already in use', 409, {
        title: 'Conflict',
        detail: 'Email already in use',
        errors: { '/email': ['Email already in use'] },
      });
    });
    render(<SignupForm onSubmit={onSubmit} />);

    fireEvent.input(screen.getByLabelText(/your name/i), { target: { value: 'Jane' } });
    fireEvent.input(screen.getByLabelText(/workspace name/i), { target: { value: 'Acme' } });
    fireEvent.input(screen.getByLabelText(/work email/i), { target: { value: 'jane@acme.test' } });
    fireEvent.input(screen.getByLabelText(/password/i), {
      target: { value: 'long-enough-password' },
    });
    fireEvent.click(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByText(/email already in use/i)).toBeInTheDocument();
    });
  });

  it('renders the switch-to-login link only when handler is supplied', () => {
    const onSubmit = vi.fn(async () => undefined);
    const onSwitch = vi.fn();
    const { rerender } = render(<SignupForm onSubmit={onSubmit} />);
    expect(screen.queryByText(/already have an account/i)).toBeNull();
    rerender(<SignupForm onSubmit={onSubmit} onSwitchToLogin={onSwitch} />);
    fireEvent.click(screen.getByText(/sign in/i));
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });
});
