import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PricingGrid } from './pricing-grid';

describe('PricingGrid', () => {
  it('renders all four tiers', () => {
    render(<PricingGrid />);
    expect(screen.getByTestId('pricing-tier-free')).toBeInTheDocument();
    expect(screen.getByTestId('pricing-tier-pro')).toBeInTheDocument();
    expect(screen.getByTestId('pricing-tier-business')).toBeInTheDocument();
    expect(screen.getByTestId('pricing-tier-enterprise')).toBeInTheDocument();
  });

  it('marks the recommended tier with the data flag', () => {
    render(<PricingGrid />);
    const pro = screen.getByTestId('pricing-tier-pro');
    expect(pro.dataset.recommended).toBe('true');
  });

  it('marks the current plan and disables its CTA', () => {
    render(<PricingGrid currentTierId="business" />);
    const business = screen.getByTestId('pricing-tier-business');
    expect(business.dataset.current).toBe('true');
    const cta = screen.getByTestId('pricing-tier-business-cta') as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    expect(cta.textContent).toBe('Current plan');
  });

  it('calls onSelect when an upgrade CTA is clicked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<PricingGrid currentTierId="free" onSelect={onSelect} />);
    await user.click(screen.getByTestId('pricing-tier-pro-cta'));
    expect(onSelect).toHaveBeenCalledWith('pro');
  });

  it('renders the Enterprise tier with a "Talk to sales" CTA', () => {
    render(<PricingGrid />);
    const cta = screen.getByTestId('pricing-tier-enterprise-cta');
    expect(cta.textContent).toBe('Talk to sales');
  });
});
