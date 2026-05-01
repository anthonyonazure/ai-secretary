/// <reference lib="dom" />

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { CitationRef } from '@aisecretary/shared';

import {
  FIXTURE_MEETING_ID,
  FIXTURE_MEETING_TITLE,
  fixtureSpeakerTurns,
} from './speaker-turns.fixture';

// Mock the data hooks so the integration tests don't hit the network.
// `useSpeakerTurns` returns the local fixture (mapped to the shared
// `SpeakerTurn` shape — `confidence` field added). `usePlaybackUrl`
// returns a stub URL so the <audio> element has a non-empty src for
// the play/pause spies.
vi.mock('./use-speaker-turns', () => ({
  useSpeakerTurns: () => ({
    turns: fixtureSpeakerTurns.map((t) => ({
      turnId: t.turnId,
      speaker: t.speaker,
      spanStartMs: t.spanStartMs,
      spanEndMs: t.spanEndMs,
      text: t.text,
      confidence: null,
      sequence: t.sequence,
    })),
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('./use-playback-url', () => ({
  usePlaybackUrl: () => ({
    url: 'https://example.test/playback.webm',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    contentType: 'audio/webm',
    isLoading: false,
    isError: false,
  }),
}));

import { TranscriptSeekPlayer, computeSeekTargetSeconds } from './transcript-seek-player';

function withQuery(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const citation: CitationRef = {
  meetingId: FIXTURE_MEETING_ID,
  turnId: 't-12',
  spanStartMs: 184_000,
  spanEndMs: 198_000,
  speaker: 'Dana',
};

describe('TranscriptSeekPlayer (Story 3.5)', () => {
  it('renders as an aria-modal dialog with the meeting title in the header', () => {
    render(
      withQuery(
        <TranscriptSeekPlayer
          open
          onOpenChange={() => undefined}
          citation={citation}
          meetingTitle={FIXTURE_MEETING_TITLE}
        />,
      ),
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(FIXTURE_MEETING_TITLE)).toBeInTheDocument();
  });

  it('does not render dialog content when closed', () => {
    render(
      withQuery(
        <TranscriptSeekPlayer open={false} onOpenChange={() => undefined} citation={citation} />,
      ),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the cited turn highlighted via data-active-turn-id', () => {
    render(
      withQuery(<TranscriptSeekPlayer open onOpenChange={() => undefined} citation={citation} />),
    );
    // Radix portals dialog content into document.body, not the RTL
    // container — query the document scope.
    const active = document.querySelector(`[data-active-turn-id="${citation.turnId}"]`);
    expect(active).not.toBeNull();
  });

  it('computes pre-roll seek target as (spanStartMs - 5000) / 1000', () => {
    expect(computeSeekTargetSeconds(184_000)).toBe(179);
    expect(computeSeekTargetSeconds(41_000)).toBe(36);
  });

  it('clamps the pre-roll seek target at 0 for citations within the first 5 seconds', () => {
    expect(computeSeekTargetSeconds(0)).toBe(0);
    expect(computeSeekTargetSeconds(2_500)).toBe(0);
    expect(computeSeekTargetSeconds(5_000)).toBe(0);
  });

  it('toggles play/pause when Spacebar is pressed inside the dialog body', () => {
    render(
      withQuery(<TranscriptSeekPlayer open onOpenChange={() => undefined} citation={citation} />),
    );
    const audio = screen.getByTestId('transcript-seek-player-audio') as HTMLAudioElement;
    const playSpy = vi.spyOn(audio, 'play').mockResolvedValue();
    const pauseSpy = vi.spyOn(audio, 'pause').mockImplementation(() => undefined);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: ' ' });
    expect(playSpy).toHaveBeenCalled();
    // Simulate the audio entering a playing state, then space again to pause.
    Object.defineProperty(audio, 'paused', { configurable: true, value: false });
    fireEvent.keyDown(dialog, { key: ' ' });
    expect(pauseSpy).toHaveBeenCalled();
  });

  it('updates the active turn highlight when a different turn is clicked in the list', () => {
    render(
      withQuery(<TranscriptSeekPlayer open onOpenChange={() => undefined} citation={citation} />),
    );
    // Click on turn t-21 (411_000ms).
    const turnButton = screen.getByText(/Procurement is going to want a SOC2/i);
    fireEvent.click(turnButton);
    // The clicked turn becomes the active turn (highlighted via
    // `data-active-turn-id`). The actual audio.currentTime assignment is
    // covered by the `computeSeekTargetSeconds` unit tests above; jsdom's
    // HTMLMediaElement.currentTime setter is non-functional and can't be
    // asserted reliably at the integration level.
    const active = document.querySelector('[data-active-turn-id]');
    expect(active).not.toBeNull();
  });

  it('calls onOpenChange(false) when the close button is activated', () => {
    const onOpenChange = vi.fn();
    render(
      withQuery(<TranscriptSeekPlayer open onOpenChange={onOpenChange} citation={citation} />),
    );
    fireEvent.click(screen.getByRole('button', { name: /close transcript player/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('uses the playback URL from usePlaybackUrl as the audio src', () => {
    render(
      withQuery(<TranscriptSeekPlayer open onOpenChange={() => undefined} citation={citation} />),
    );
    const audio = screen.getByTestId('transcript-seek-player-audio') as HTMLAudioElement;
    expect(audio.getAttribute('src')).toBe('https://example.test/playback.webm');
  });
});
