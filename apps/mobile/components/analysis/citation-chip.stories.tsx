import type { Meta, StoryObj } from '@storybook/react';
import { Text, View } from 'react-native';

import type { CitationRef } from '@aisecretary/shared';

import { CitationChip } from './citation-chip';
import { FIXTURE_MEETING_ID } from './speaker-turns.fixture';

const meta: Meta<typeof CitationChip> = {
  title: 'Feature/Analysis/CitationChip (RN)',
  component: CitationChip,
  decorators: [
    (Story) => (
      <View className="bg-bg p-4">
        <Story />
      </View>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CitationChip>;

const known: CitationRef = {
  meetingId: FIXTURE_MEETING_ID,
  turnId: 't-12',
  spanStartMs: 184_000,
  spanEndMs: 198_000,
  speaker: 'Dana',
};

const missing: CitationRef = {
  meetingId: FIXTURE_MEETING_ID,
  turnId: 't-not-in-fixture',
  spanStartMs: 999_000,
  spanEndMs: 1_001_000,
};

export const Inline: Story = {
  args: { citation: known, variant: 'inline' },
};

export const Block: Story = {
  args: { citation: known, variant: 'block' },
};

export const Compact: Story = {
  args: { citation: known, variant: 'compact' },
};

export const Disabled: Story = {
  args: { citation: missing, variant: 'inline' },
};

export const InProse: Story = {
  args: { citation: known, variant: 'inline' },
  render: (args) => (
    <View className="max-w-[480px]">
      <Text className="text-sm text-fg leading-normal">
        Three decisions were made; two need follow-up by Friday.
      </Text>
      <View className="mt-1 flex-row">
        <CitationChip {...args} />
      </View>
    </View>
  ),
};
