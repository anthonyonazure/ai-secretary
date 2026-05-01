import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DisclosureCopyForm } from './disclosure-copy-form';

const baseValue = {
  preMic: 'We record your meetings.',
  botAnnouncement: 'AI Secretary is recording this meeting.',
  patientArtifact: 'Recording for medical record purposes.',
  inPersonConsentRequired: false,
};

describe('DisclosureCopyForm', () => {
  it('renders all three textareas + the region pin display', () => {
    render(<DisclosureCopyForm value={baseValue} region="us" regionPinned onSave={() => {}} />);
    expect(screen.getByTestId('disclosure-preMic-input')).toBeInTheDocument();
    expect(screen.getByTestId('disclosure-botAnnouncement-input')).toBeInTheDocument();
    expect(screen.getByTestId('disclosure-patientArtifact-input')).toBeInTheDocument();
    expect(screen.getByTestId('disclosure-region-display').textContent).toMatch(/United States/);
    expect(screen.getByTestId('disclosure-region-display').textContent).toMatch(
      /pinned \(immutable per ADR-0004\)/,
    );
  });

  it('shows the unpinned hint when regionPinned is false', () => {
    render(
      <DisclosureCopyForm value={baseValue} region="eu" regionPinned={false} onSave={() => {}} />,
    );
    expect(screen.getByTestId('disclosure-region-display').textContent).toMatch(/not yet pinned/);
  });

  it('saves the edited values', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<DisclosureCopyForm value={baseValue} region="us" regionPinned onSave={onSave} />);
    const preMic = screen.getByTestId('disclosure-preMic-input') as HTMLTextAreaElement;
    await user.clear(preMic);
    await user.type(preMic, 'Updated pre-mic copy.');
    await user.click(screen.getByTestId('disclosure-copy-save'));
    expect(onSave).toHaveBeenCalledWith({
      ...baseValue,
      preMic: 'Updated pre-mic copy.',
    });
  });

  it('toggles in-person consent', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<DisclosureCopyForm value={baseValue} region="us" regionPinned onSave={onSave} />);
    await user.click(screen.getByTestId('disclosure-in-person-toggle'));
    await user.click(screen.getByTestId('disclosure-copy-save'));
    expect(onSave).toHaveBeenCalledWith({ ...baseValue, inPersonConsentRequired: true });
  });
});
