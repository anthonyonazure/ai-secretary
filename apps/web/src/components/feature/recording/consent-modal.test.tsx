/// <reference lib="dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConsentModal } from './consent-modal';

describe('ConsentModal (Story 4.3 — shape A)', () => {
  it('renders the disclosure title and body when open', () => {
    render(
      <ConsentModal
        open
        legalBasis="legitimate-interest"
        onAcknowledge={() => undefined}
        onDecline={() => undefined}
      />,
    );
    expect(screen.getByText(/before we start recording/i)).toBeInTheDocument();
    // Default body paragraphs are rendered.
    expect(screen.getByText(/this meeting will be recorded/i)).toBeInTheDocument();
  });

  it('keeps the acknowledge button disabled until the checkbox is ticked', () => {
    const onAcknowledge = vi.fn();
    render(
      <ConsentModal
        open
        legalBasis="legitimate-interest"
        onAcknowledge={onAcknowledge}
        onDecline={() => undefined}
      />,
    );
    const ackButton = screen.getByTestId('consent-modal-acknowledge') as HTMLButtonElement;
    expect(ackButton).toBeDisabled();

    fireEvent.click(ackButton);
    expect(onAcknowledge).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('consent-modal-ack-checkbox'));
    expect(ackButton).toBeEnabled();
    fireEvent.click(ackButton);
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it('requires the EU explicit checkbox under explicit-consent legal basis', () => {
    const onAcknowledge = vi.fn();
    render(
      <ConsentModal
        open
        legalBasis="explicit-consent"
        onAcknowledge={onAcknowledge}
        onDecline={() => undefined}
      />,
    );
    const ackButton = screen.getByTestId('consent-modal-acknowledge') as HTMLButtonElement;
    fireEvent.click(screen.getByTestId('consent-modal-ack-checkbox'));
    // Still disabled — EU checkbox not yet ticked.
    expect(ackButton).toBeDisabled();
    fireEvent.click(screen.getByTestId('consent-modal-eu-checkbox'));
    expect(ackButton).toBeEnabled();
    fireEvent.click(ackButton);
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it('renders the EU explicit note only under explicit-consent legal basis', () => {
    const { rerender } = render(
      <ConsentModal
        open
        legalBasis="legitimate-interest"
        onAcknowledge={() => undefined}
        onDecline={() => undefined}
      />,
    );
    expect(screen.queryByTestId('consent-modal-eu-note')).toBeNull();

    rerender(
      <ConsentModal
        open
        legalBasis="explicit-consent"
        onAcknowledge={() => undefined}
        onDecline={() => undefined}
      />,
    );
    expect(screen.getByTestId('consent-modal-eu-note')).toBeInTheDocument();
  });

  it('decline path triggers onDecline immediately', () => {
    const onDecline = vi.fn();
    render(
      <ConsentModal
        open
        legalBasis="legitimate-interest"
        onAcknowledge={() => undefined}
        onDecline={onDecline}
      />,
    );
    fireEvent.click(screen.getByTestId('consent-modal-decline'));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('exposes a dialog role when open (Radix)', () => {
    render(
      <ConsentModal
        open
        legalBasis="legitimate-interest"
        onAcknowledge={() => undefined}
        onDecline={() => undefined}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the org-configurable custom disclosure paragraph when provided', () => {
    render(
      <ConsentModal
        open
        legalBasis="legitimate-interest"
        customDisclosure="Recordings retained for 30 days per HR policy."
        onAcknowledge={() => undefined}
        onDecline={() => undefined}
      />,
    );
    expect(screen.getByText(/recordings retained for 30 days/i)).toBeInTheDocument();
  });
});
