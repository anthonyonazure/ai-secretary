import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConsentPolicyForm } from './consent-policy-form';

describe('ConsentPolicyForm', () => {
  it('renders with the supplied policy values selected', () => {
    render(
      <ConsentPolicyForm
        value={{
          legalBasis: 'explicit-per-participant',
          optOutBehavior: 'auto-quarantine',
        }}
        onSave={() => {}}
      />,
    );
    const explicit = screen.getByTestId('consent-legal-basis-explicit') as HTMLInputElement;
    const implicit = screen.getByTestId('consent-legal-basis-implicit') as HTMLInputElement;
    expect(explicit.checked).toBe(true);
    expect(implicit.checked).toBe(false);
  });

  it('calls onSave with the chosen values', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <ConsentPolicyForm
        value={{
          legalBasis: 'legitimate-interest-implicit',
          optOutBehavior: 'per-participant-exclusion',
        }}
        onSave={onSave}
      />,
    );
    await user.click(screen.getByTestId('consent-legal-basis-explicit'));
    await user.click(screen.getByTestId('consent-optout-quarantine'));
    await user.click(screen.getByTestId('consent-policy-save'));
    expect(onSave).toHaveBeenCalledWith({
      legalBasis: 'explicit-per-participant',
      optOutBehavior: 'auto-quarantine',
    });
  });

  it('disables the save button while a mutation is pending', () => {
    render(
      <ConsentPolicyForm
        value={{
          legalBasis: 'explicit-per-participant',
          optOutBehavior: 'auto-quarantine',
        }}
        onSave={() => {}}
        isPending
      />,
    );
    const btn = screen.getByTestId('consent-policy-save') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('Saving…');
  });
});
