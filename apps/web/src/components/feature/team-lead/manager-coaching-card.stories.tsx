import type { Meta, StoryObj } from '@storybook/react';

import { ManagerCoachingCard } from './manager-coaching-card';

const meta: Meta<typeof ManagerCoachingCard> = {
  title: 'Feature/TeamLead/ManagerCoachingCard',
  component: ManagerCoachingCard,
  parameters: {
    docs: {
      description: {
        component:
          'Story 8.6 team-lead annotation. Anti-surveillance discipline: no scoreboard, no leaderboard, no role-tag chrome — coach name shows as a human name. Span anchor uses the same CitationChip glyph so the note feels like a peer annotation.',
      },
    },
  },
  args: {
    onShareBack: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof ManagerCoachingCard>;

const baseAnnotation = {
  id: 'a-1',
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

export const Pending: Story = {
  args: { annotation: baseAnnotation },
};

export const SharedBack: Story = {
  args: { annotation: { ...baseAnnotation, sharedBack: true } },
};

export const ReadOnly: Story = {
  render: () => <ManagerCoachingCard annotation={baseAnnotation} />,
  parameters: {
    docs: {
      description: {
        story: 'When `onShareBack` is omitted, the card renders read-only — no share-back button.',
      },
    },
  },
};
