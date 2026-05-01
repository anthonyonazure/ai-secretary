/// <reference lib="dom" />

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthFetchError } from '../../../lib/auth/auth-fetch';
import { MfaChallengeForm } from './mfa-challenge-form';

describe('MfaChallengeForm (Story 1.5c)', () => {
  it('submits a TOTP code with the bound challenge token', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<MfaChallengeForm challengeToken="ct-123" onSubmit={onSubmit} />);

    fireEvent.input(screen.getByLabelText(/authentication code/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByTestId('mfa-verify-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ challengeToken: 'ct-123', code: '123456' });
  });

  it('toggles to recovery code mode and submits a recovery code', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<MfaChallengeForm challengeToken="ct-123" onSubmit={onSubmit} />);

    fireEvent.click(screen.getByTestId('mfa-toggle-recovery'));
    expect(screen.getByLabelText(/recovery code/i)).toBeInTheDocument();

    fireEvent.input(screen.getByLabelText(/recovery code/i), {
      target: { value: 'a1b2-c3d4-e5f6' },
    });
    fireEvent.click(screen.getByTestId('mfa-verify-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      challengeToken: 'ct-123',
      code: 'a1b2-c3d4-e5f6',
    });
  });

  it('renders an RFC 7807 401 server error banner', () => {
    render(
      <MfaChallengeForm
        challengeToken="ct-123"
        onSubmit={async () => undefined}
        serverError={
          new AuthFetchError('Invalid MFA code', 401, {
            title: 'Unauthorized',
            detail: 'Invalid MFA code',
            requestId: 'req_mfa',
          })
        }
      />,
    );
    expect(screen.getByText(/invalid mfa code/i)).toBeInTheDocument();
    expect(screen.getByText(/req_mfa/i)).toBeInTheDocument();
  });

  it('hides the recovery toggle when forced enrollment is required', () => {
    render(
      <MfaChallengeForm challengeToken="ct" onSubmit={async () => undefined} hideRecoveryToggle />,
    );
    expect(screen.queryByTestId('mfa-toggle-recovery')).not.toBeInTheDocument();
  });
});
