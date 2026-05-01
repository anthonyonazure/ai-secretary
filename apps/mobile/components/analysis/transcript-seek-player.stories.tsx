import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { CitationRef } from '@aisecretary/shared';

import { FIXTURE_MEETING_ID, FIXTURE_MEETING_TITLE } from './speaker-turns.fixture';
import { TranscriptSeekPlayer } from './transcript-seek-player';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const meta: Meta<typeof TranscriptSeekPlayer> = {
  title: 'Feature/Analysis/TranscriptSeekPlayer (RN)',
  component: TranscriptSeekPlayer,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <View className="flex-1 bg-bg p-4">
          <Story />
        </View>
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
      <>
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          className="h-11 items-center justify-center rounded-md bg-accent px-4"
        >
          <Text className="text-bg">Open transcript</Text>
        </Pressable>
        <TranscriptSeekPlayer
          open={open}
          onOpenChange={setOpen}
          citation={citation}
          meetingTitle={FIXTURE_MEETING_TITLE}
        />
      </>
    );
  },
};
