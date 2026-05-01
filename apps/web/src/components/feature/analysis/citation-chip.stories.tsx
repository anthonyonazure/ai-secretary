import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { CitationRef } from '@aisecretary/shared';

import { CitationChip } from './citation-chip';
import { FIXTURE_MEETING_ID } from './speaker-turns.fixture';

// One client per stories module is fine — Storybook runs stories in
// isolation, and the player surface needs a QueryClient when a chip
// click opens the embedded TranscriptSeekPlayer.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const meta: Meta<typeof CitationChip> = {
  title: 'Feature/Analysis/CitationChip',
  component: CitationChip,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'V2 iconic-glyph citation token. Pill container · speaker glyph (interim lucide `MessageSquareQuote` until designer brief lands the bespoke illustration) · mono timestamp · hover/focus preview · click → opens TranscriptSeekPlayer + plays 5s pre-roll. Variants: `inline` / `block` / `compact`. Visited state persists in sessionStorage keyed by `(meetingId, turnId)`.',
      },
    },
  },
  argTypes: {
    variant: { control: { type: 'radio' }, options: ['inline', 'block', 'compact'] },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CitationChip>;

const knownCitation: CitationRef = {
  meetingId: FIXTURE_MEETING_ID,
  turnId: 't-12',
  spanStartMs: 184_000,
  spanEndMs: 198_000,
  speaker: 'Dana',
};

const unknownCitation: CitationRef = {
  meetingId: FIXTURE_MEETING_ID,
  turnId: 't-does-not-exist',
  spanStartMs: 999_000,
  spanEndMs: 1_001_000,
};

export const Inline: Story = {
  args: { citation: knownCitation, variant: 'inline' },
};

export const Block: Story = {
  args: { citation: knownCitation, variant: 'block' },
  parameters: {
    docs: {
      description: {
        story:
          'Block variant — used in standalone reference lists (multi-line preview, taller hit area).',
      },
    },
  },
};

export const Compact: Story = {
  args: { citation: knownCitation, variant: 'compact' },
  parameters: {
    docs: {
      description: {
        story: 'Compact variant — used in dense email digests / summary contexts.',
      },
    },
  },
};

export const Disabled: Story = {
  args: { citation: unknownCitation, variant: 'inline' },
  parameters: {
    docs: {
      description: {
        story:
          'Citation source missing — chip renders grayed with `aria-label="Citation unavailable"`. Click is a no-op.',
      },
    },
  },
};

export const Visited: Story = {
  args: { citation: knownCitation, variant: 'inline' },
  decorators: [
    (Story) => {
      // Pre-seed sessionStorage so the chip mounts in the visited state.
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(
            `citation-chip:visited:${knownCitation.meetingId}:${knownCitation.turnId}`,
            '1',
          );
        } catch {
          // ignore
        }
      }
      return <Story />;
    },
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Visited state — subtle border shift signals the user has already opened this citation in the current session.',
      },
    },
  },
};

export const FocusRing: Story = {
  args: { citation: knownCitation, variant: 'inline' },
  parameters: {
    docs: {
      description: {
        story:
          'Keyboard focus state — focus ring per token. Tab into the chip to verify; the focus-visible ring uses the `--accent` token. Hovering or focusing also surfaces the preview tooltip.',
      },
    },
  },
};

export const HoverWithPreview: Story = {
  args: { citation: knownCitation, variant: 'inline' },
  parameters: {
    docs: {
      description: {
        story:
          'Hover/focus preview — speaker name + transcript snippet. Loaded from the dev fixture; production sources from `useSpeakerTurns`. Hover the chip or Tab to it to surface the tooltip.',
      },
    },
  },
};

export const InProse: Story = {
  args: { citation: knownCitation, variant: 'inline' },
  render: (args) => (
    <p className="max-w-prose text-sm text-fg leading-normal">
      Three decisions were made; two need follow-up by Friday <CitationChip {...args} />. Recurring
      topic: customers are asking about EU data residency{' '}
      <CitationChip
        citation={{
          meetingId: FIXTURE_MEETING_ID,
          turnId: 't-37',
          spanStartMs: 612_000,
          spanEndMs: 624_000,
          speaker: 'Sam',
        }}
      />
      .
    </p>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Inline chips inside prose — production layout context.',
      },
    },
  },
};

export const DarkTheme: Story = {
  args: { citation: knownCitation, variant: 'inline' },
  decorators: [
    (Story) => (
      <div className="theme-dark bg-bg p-6">
        <Story />
      </div>
    ),
  ],
};
