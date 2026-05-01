import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';

import { RecordingButton } from './recording-button';

const meta: Meta<typeof RecordingButton> = {
  title: 'Feature/Recording/RecordingButton (RN)',
  component: RecordingButton,
  args: {
    state: { kind: 'idle' },
    onStart: () => undefined,
    onStop: () => undefined,
    onRetry: () => undefined,
  },
  decorators: [
    (Story) => (
      <View className="bg-bg p-4">
        <Story />
      </View>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RecordingButton>;

export const Idle: Story = {};
export const Recording: Story = {
  args: { state: { kind: 'recording', startedAt: Date.now() } },
};
export const Uploading: Story = {
  args: { state: { kind: 'uploading', recordingId: 'demo', progress: 0.4 } },
};
export const Errored: Story = {
  args: { state: { kind: 'error', reason: 'Network unavailable', retryable: true } },
};
