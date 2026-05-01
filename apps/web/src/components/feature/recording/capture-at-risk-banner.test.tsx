import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CaptureAtRiskBanner } from './capture-at-risk-banner';

describe('CaptureAtRiskBanner', () => {
  it('uses role="alert" + aria-live="assertive"', () => {
    render(
      <CaptureAtRiskBanner
        secondsSinceLastPing={120}
        onContinue={() => {}}
        onPause={() => {}}
        onStop={() => {}}
      />,
    );
    const banner = screen.getByTestId('capture-at-risk-banner');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.getAttribute('aria-live')).toBe('assertive');
  });

  it('renders the three primary CTAs', () => {
    render(
      <CaptureAtRiskBanner
        secondsSinceLastPing={120}
        onContinue={() => {}}
        onPause={() => {}}
        onStop={() => {}}
      />,
    );
    expect(screen.getByTestId('capture-at-risk-continue')).toBeInTheDocument();
    expect(screen.getByTestId('capture-at-risk-pause')).toBeInTheDocument();
    expect(screen.getByTestId('capture-at-risk-stop')).toBeInTheDocument();
  });

  it('wires the callbacks correctly', async () => {
    const onContinue = vi.fn();
    const onPause = vi.fn();
    const onStop = vi.fn();
    const user = userEvent.setup();
    render(
      <CaptureAtRiskBanner
        secondsSinceLastPing={120}
        onContinue={onContinue}
        onPause={onPause}
        onStop={onStop}
      />,
    );
    await user.click(screen.getByTestId('capture-at-risk-continue'));
    await user.click(screen.getByTestId('capture-at-risk-pause'));
    await user.click(screen.getByTestId('capture-at-risk-stop'));
    expect(onContinue).toHaveBeenCalled();
    expect(onPause).toHaveBeenCalled();
    expect(onStop).toHaveBeenCalled();
  });

  it('renders the dismiss button only when onDismiss is supplied', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <CaptureAtRiskBanner
        secondsSinceLastPing={120}
        onContinue={() => {}}
        onPause={() => {}}
        onStop={() => {}}
      />,
    );
    expect(screen.queryByTestId('capture-at-risk-dismiss')).not.toBeInTheDocument();
    rerender(
      <CaptureAtRiskBanner
        secondsSinceLastPing={120}
        onContinue={() => {}}
        onPause={() => {}}
        onStop={() => {}}
        onDismiss={onDismiss}
      />,
    );
    await user.click(screen.getByTestId('capture-at-risk-dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
