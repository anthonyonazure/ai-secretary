import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IntegrationCredentialsForm } from './integration-credentials-form';

describe('IntegrationCredentialsForm', () => {
  it('renders the empty form for a fresh tenant', () => {
    render(
      <IntegrationCredentialsForm
        provider="zoom"
        hasExistingCredentials={false}
        onSave={() => {}}
      />,
    );
    expect(screen.getByTestId('integration-zoom-accountId')).toBeInTheDocument();
    expect(screen.getByTestId('integration-zoom-clientId')).toBeInTheDocument();
    expect(screen.getByTestId('integration-zoom-clientSecret')).toBeInTheDocument();
  });

  it('shows a "Replace" CTA when credentials are already persisted', () => {
    render(
      <IntegrationCredentialsForm
        provider="teams"
        hasExistingCredentials={true}
        onSave={() => {}}
      />,
    );
    expect(screen.getByTestId('integration-replace-teams')).toBeInTheDocument();
    // Form fields are hidden behind the replace gate.
    expect(screen.queryByTestId('integration-teams-clientId')).not.toBeInTheDocument();
  });

  it('reveals the form fields when "Replace" is clicked', async () => {
    const user = userEvent.setup();
    render(
      <IntegrationCredentialsForm
        provider="teams"
        hasExistingCredentials={true}
        onSave={() => {}}
      />,
    );
    await user.click(screen.getByTestId('integration-replace-teams'));
    expect(screen.getByTestId('integration-teams-clientId')).toBeInTheDocument();
  });

  it('keeps the secret field as a password input by default', () => {
    render(
      <IntegrationCredentialsForm
        provider="zoom"
        hasExistingCredentials={false}
        onSave={() => {}}
      />,
    );
    const secret = screen.getByTestId('integration-zoom-clientSecret') as HTMLInputElement;
    expect(secret.type).toBe('password');
  });

  it('calls onSave with the form values', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <IntegrationCredentialsForm provider="zoom" hasExistingCredentials={false} onSave={onSave} />,
    );
    await user.type(screen.getByTestId('integration-zoom-accountId'), 'acct-123');
    await user.type(screen.getByTestId('integration-zoom-clientId'), 'client-abc');
    await user.type(screen.getByTestId('integration-zoom-clientSecret'), 'secret-xyz');
    await user.click(screen.getByTestId('integration-save-zoom'));
    expect(onSave).toHaveBeenCalledWith({
      accountId: 'acct-123',
      clientId: 'client-abc',
      clientSecret: 'secret-xyz',
    });
  });
});
