import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FIRST_LAUNCH_STORAGE_KEY_FOR_TEST,
  useFirstLaunchStore,
} from '../../../hooks/first-launch-store';
import { FirstReceiptPolish } from './first-receipt-polish';

afterEach(() => {
  useFirstLaunchStore.getState().reset();
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(FIRST_LAUNCH_STORAGE_KEY_FOR_TEST);
  }
});

const mount = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

describe('FirstReceiptPolish', () => {
  it('wraps children with celebration polish on first receipt', () => {
    mount(
      <FirstReceiptPolish meetingId="m1">
        <div data-testid="child" />
      </FirstReceiptPolish>,
    );
    expect(screen.getByTestId('first-receipt-polish')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
    // Thumbs prompt appears below.
    expect(screen.getByTestId('thumbs-prompt')).toBeInTheDocument();
  });

  it('falls back to calm default after 3 receipts viewed', () => {
    const store = useFirstLaunchStore.getState();
    store.markReceiptViewed('m1');
    store.markReceiptViewed('m2');
    store.markReceiptViewed('m3');

    mount(
      <FirstReceiptPolish meetingId="m4">
        <div data-testid="child" />
      </FirstReceiptPolish>,
    );

    expect(screen.getByTestId('first-receipt-polish-calm')).toBeInTheDocument();
    expect(screen.queryByTestId('first-receipt-polish')).not.toBeInTheDocument();
    expect(screen.queryByTestId('thumbs-prompt')).not.toBeInTheDocument();
  });

  it('uses reduced-motion fallback when reducedMotion is true', () => {
    mount(
      <FirstReceiptPolish meetingId="m1" reducedMotion>
        <div data-testid="child" />
      </FirstReceiptPolish>,
    );
    const polish = screen.getByTestId('first-receipt-polish');
    expect(polish.getAttribute('data-reduced-motion')).toBe('true');
  });

  it('does NOT use reduced-motion fallback when reducedMotion is false', () => {
    mount(
      <FirstReceiptPolish meetingId="m1" reducedMotion={false}>
        <div data-testid="child" />
      </FirstReceiptPolish>,
    );
    const polish = screen.getByTestId('first-receipt-polish');
    expect(polish.getAttribute('data-reduced-motion')).toBe('false');
  });

  it('marks the meeting receipt as viewed on mount', () => {
    mount(
      <FirstReceiptPolish meetingId="m-fresh">
        <div />
      </FirstReceiptPolish>,
    );
    expect(useFirstLaunchStore.getState().viewedMeetingIds).toContain('m-fresh');
  });
});
