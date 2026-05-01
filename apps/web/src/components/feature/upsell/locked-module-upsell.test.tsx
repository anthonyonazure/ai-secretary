import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LockedModuleUpsell } from './locked-module-upsell';

describe('LockedModuleUpsell', () => {
  it('renders the feature label + minimum tier', () => {
    render(
      <LockedModuleUpsell
        feature="medical"
        featureLabel="The medical module"
        minimumTier="business"
      />,
    );
    expect(screen.getByTestId('locked-module-upsell')).toHaveAttribute('data-feature', 'medical');
    expect(screen.getByTestId('locked-module-upsell').dataset.minimumTier).toBe('business');
    expect(screen.getByText(/The medical module/)).toBeInTheDocument();
    expect(screen.getByText(/Business/)).toBeInTheDocument();
  });

  it('calls onUpgrade when the CTA is clicked', async () => {
    const onUpgrade = vi.fn();
    const user = userEvent.setup();
    render(
      <LockedModuleUpsell
        feature="bot"
        featureLabel="Meeting bot"
        minimumTier="pro"
        onUpgrade={onUpgrade}
      />,
    );
    await user.click(screen.getByTestId('locked-module-upgrade'));
    expect(onUpgrade).toHaveBeenCalled();
  });

  it('renders the dismiss button only when onDismiss is supplied', () => {
    const { rerender } = render(
      <LockedModuleUpsell feature="bot" featureLabel="Meeting bot" minimumTier="pro" />,
    );
    expect(screen.queryByTestId('locked-module-dismiss')).not.toBeInTheDocument();
    rerender(
      <LockedModuleUpsell
        feature="bot"
        featureLabel="Meeting bot"
        minimumTier="pro"
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByTestId('locked-module-dismiss')).toBeInTheDocument();
  });

  it('renders the optional description', () => {
    render(
      <LockedModuleUpsell
        feature="medical"
        featureLabel="Medical module"
        minimumTier="business"
        description="HIPAA-eligible routing requires the Business tier or higher."
      />,
    );
    expect(
      screen.getByText(/HIPAA-eligible routing requires the Business tier or higher\./),
    ).toBeInTheDocument();
  });
});
