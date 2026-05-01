import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { type CoachingAnnotation, ManagerCoachingCard } from './manager-coaching-card';

const annotation: CoachingAnnotation = {
  id: 'a1',
  note: 'Nice job restating their concern back to them — keep doing that.',
  citation: {
    meetingId: '11111111-1111-1111-1111-111111111111',
    turnId: 'turn-12',
    spanStartMs: 65_000,
    spanEndMs: 72_000,
    speaker: 'Anthony',
  },
  coachName: 'Casey Lee',
  createdAt: '2026-04-29T15:00:00.000Z',
  sharedBack: false,
};

describe('ManagerCoachingCard', () => {
  it('renders coach name + note + span anchor', () => {
    render(<ManagerCoachingCard annotation={annotation} />);
    expect(screen.getByText('Casey Lee')).toBeInTheDocument();
    expect(screen.getByText(/Nice job restating/)).toBeInTheDocument();
    expect(screen.getByText(/Anthony · 1:05/)).toBeInTheDocument();
  });

  it('omits surveillance affordances (no score, no role label)', () => {
    render(<ManagerCoachingCard annotation={annotation} />);
    // Spot-check that we never render an explicit "manager" role label.
    expect(screen.queryByText(/manager/i)).not.toBeInTheDocument();
    // No percentile / score chrome.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('calls onShareBack when the share button is clicked', async () => {
    const onShareBack = vi.fn();
    const user = userEvent.setup();
    render(<ManagerCoachingCard annotation={annotation} onShareBack={onShareBack} />);
    await user.click(screen.getByTestId('share-back'));
    expect(onShareBack).toHaveBeenCalledWith('a1');
  });

  it('hides the share button once the note has been shared back', () => {
    render(
      <ManagerCoachingCard
        annotation={{ ...annotation, sharedBack: true }}
        onShareBack={() => {}}
      />,
    );
    expect(screen.queryByTestId('share-back')).not.toBeInTheDocument();
    expect(screen.getByTestId('shared-back-indicator')).toBeInTheDocument();
  });

  it('renders without a share-back button when onShareBack is omitted (read-only)', () => {
    render(<ManagerCoachingCard annotation={annotation} />);
    expect(screen.queryByTestId('share-back')).not.toBeInTheDocument();
  });
});
