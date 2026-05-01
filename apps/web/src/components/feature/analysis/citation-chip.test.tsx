/// <reference lib="dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CitationRef } from '@aisecretary/shared';

import { CitationChip } from './citation-chip';
import { FIXTURE_MEETING_ID } from './speaker-turns.fixture';

const knownCitation: CitationRef = {
  meetingId: FIXTURE_MEETING_ID,
  turnId: 't-12',
  spanStartMs: 184_000,
  spanEndMs: 198_000,
  speaker: 'Dana',
};

const unknownCitation: CitationRef = {
  meetingId: FIXTURE_MEETING_ID,
  turnId: 't-missing',
  spanStartMs: 999_000,
  spanEndMs: 1_001_000,
};

afterEach(() => {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
  }
});

describe('CitationChip V2 (Story 3.5)', () => {
  it('renders the timestamp + accessible label including speaker name', () => {
    render(<CitationChip citation={knownCitation} onClick={() => undefined} />);
    const button = screen.getByRole('button', { name: /citation at 03:04, speaker dana/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('03:04');
  });

  it('exposes the (meetingId, turnId) deep-link contract via data attributes (Story 3.6 substrate)', () => {
    render(<CitationChip citation={knownCitation} onClick={() => undefined} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-citation-meeting-id', knownCitation.meetingId);
    expect(button).toHaveAttribute('data-citation-turn-id', knownCitation.turnId);
  });

  it('fires onClick with the citation on Enter and on Space when host controls the seek', () => {
    const onClick = vi.fn();
    render(<CitationChip citation={knownCitation} onClick={onClick} />);
    const button = screen.getByRole('button');
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledWith(knownCitation);
    fireEvent.keyDown(button, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('fires onClick on mouse click as well', () => {
    const onClick = vi.fn();
    render(<CitationChip citation={knownCitation} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(knownCitation);
  });

  it('renders the disabled state when the citation source is missing', () => {
    render(<CitationChip citation={unknownCitation} onClick={() => undefined} />);
    const button = screen.getByRole('button', { name: /citation unavailable/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-state', 'disabled');
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    render(<CitationChip citation={unknownCitation} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows the hover preview tooltip on focus and links it via aria-describedby', () => {
    render(<CitationChip citation={knownCitation} onClick={() => undefined} />);
    const button = screen.getByRole('button');
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(button);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-describedby', tooltip.id);
    fireEvent.blur(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('persists the visited state to sessionStorage keyed by (meetingId, turnId)', () => {
    render(<CitationChip citation={knownCitation} onClick={() => undefined} />);
    fireEvent.click(screen.getByRole('button'));
    const key = `citation-chip:visited:${knownCitation.meetingId}:${knownCitation.turnId}`;
    expect(window.sessionStorage.getItem(key)).toBe('1');
  });

  it('enforces a ≥44px touch target via the wrapping span', () => {
    const { container } = render(
      <CitationChip citation={knownCitation} onClick={() => undefined} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toMatch(/min-h-11/);
    expect(wrapper.className).toMatch(/min-w-11/);
  });

  it('honors the variant prop on data-variant', () => {
    const { rerender } = render(
      <CitationChip citation={knownCitation} variant="block" onClick={() => undefined} />,
    );
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'block');
    rerender(<CitationChip citation={knownCitation} variant="compact" onClick={() => undefined} />);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'compact');
  });
});
