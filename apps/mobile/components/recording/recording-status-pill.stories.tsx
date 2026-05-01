import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';

import { RecordingStatusPill } from './recording-status-pill';

const meta: Meta<typeof RecordingStatusPill> = {
  title: 'Feature/Recording/RecordingStatusPill (RN)',
  component: RecordingStatusPill,
  argTypes: {
    state: { control: { type: 'radio' }, options: ['idle', 'recording', 'paused'] },
    variant: { control: { type: 'radio' }, options: ['compact', 'standard', 'with-device'] },
  },
  args: {
    state: 'recording',
    elapsedSeconds: 154,
    variant: 'standard',
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
type Story = StoryObj<typeof RecordingStatusPill>;

export const Recording: Story = {};

export const Paused: Story = {
  args: { state: 'paused', elapsedSeconds: 78 },
};

export const Compact: Story = {
  args: { variant: 'compact', elapsedSeconds: 32 },
};

export const WithDeviceChip: Story = {
  args: {
    variant: 'with-device',
    elapsedSeconds: 612,
    device: { name: 'AirPods Pro', type: 'bluetooth' },
  },
};

export const LongRecording: Story = {
  args: { elapsedSeconds: 5_412 },
};
