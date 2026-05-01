import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import type { CitationRef } from '@aisecretary/shared';

import { FIXTURE_MEETING_ID, FIXTURE_MEETING_TITLE } from './speaker-turns.fixture';
import { TranscriptSeekPlayer } from './transcript-seek-player';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const meta: Meta<typeof TranscriptSeekPlayer> = {
  title: 'Feature/Analysis/TranscriptSeekPlayer',
  component: TranscriptSeekPlayer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Modal opened by `CitationChip` clicks. Seeks to `spanStartMs - 5000` (clamped at 0), auto-plays the audio, scrolls the cited turn into view, and lets the user click any other turn to re-seek. Spacebar toggles play/pause. Reduced-motion swaps the smooth scroll for a jump.',
      },
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TranscriptSeekPlayer>;

const citation: CitationRef = {
  meetingId: FIXTURE_MEETING_ID,
  turnId: 't-12',
  spanStartMs: 184_000,
  spanEndMs: 198_000,
  speaker: 'Dana',
};

export const Open: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <TranscriptSeekPlayer
        open={open}
        onOpenChange={setOpen}
        citation={citation}
        meetingTitle={FIXTURE_MEETING_TITLE}
      />
    );
  },
};

export const OpenWithUnknownTurn: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <TranscriptSeekPlayer
        open={open}
        onOpenChange={setOpen}
        citation={{ ...citation, turnId: 't-not-in-fixture' }}
        meetingTitle={FIXTURE_MEETING_TITLE}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Cited turn isn't in the transcript (e.g. transcription re-ran and dropped the row). The list still renders; no turn is highlighted.",
      },
    },
  },
};
