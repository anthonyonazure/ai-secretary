import type { Meta, StoryObj } from '@storybook/react';

import { RecordingStatusPill } from './recording-status-pill';

const meta: Meta<typeof RecordingStatusPill> = {
  title: 'Feature/Recording/RecordingStatusPill',
  component: RecordingStatusPill,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'V2 inline-waveform recording-status primitive. Used identically across phone lock screen, browser tab pill, bot status row, embed surfaces, and calendar markers. V1 (pulse-dot) and V3 (gradient ring) are discarded — V2 is canonical.',
      },
    },
  },
  argTypes: {
    state: { control: { type: 'radio' }, options: ['idle', 'recording', 'paused'] },
    variant: { control: { type: 'radio' }, options: ['compact', 'standard', 'with-device'] },
    elapsedSeconds: { control: { type: 'number', min: 0, max: 7200, step: 1 } },
  },
  args: {
    state: 'recording',
    elapsedSeconds: 154,
    variant: 'standard',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RecordingStatusPill>;

export const Recording: Story = {};

export const Paused: Story = {
  args: { state: 'paused', elapsedSeconds: 78 },
};

export const Idle: Story = {
  args: { state: 'idle', elapsedSeconds: 0 },
  parameters: {
    docs: {
      description: {
        story:
          'Idle renders nothing — the slot stays mounted across shells but invisible. Allows `AppShell.*` to keep a stable position for the pill without conditional rendering.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story: 'Timer overflows past 99 minutes to MMM:SS — long meetings stay readable.',
      },
    },
  },
};

export const WithStopAction: Story = {
  args: {
    onStop: () => {
      // Storybook actions addon catches this when wired; placeholder no-op.
    },
  },
};

export const ReducedMotion: Story = {
  args: { elapsedSeconds: 154 },
  decorators: [
    (Story) => (
      <div className="motion-reduced">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Reduced-motion fallback: bars freeze at varied heights (no animation). Triggered by the `.motion-reduced` host class OR the OS `prefers-reduced-motion` preference — both code paths produce the same visual.',
      },
    },
  },
};

export const DarkTheme: Story = {
  args: { elapsedSeconds: 154 },
  decorators: [
    (Story) => (
      <div className="theme-dark bg-bg p-6">
        <Story />
      </div>
    ),
  ],
};

export const AccessibleDensity: Story = {
  args: { elapsedSeconds: 154 },
  decorators: [
    (Story) => (
      <div className="density-accessible">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Accessible density mode — touch targets are 44px AAA-compliant per Step 8. The pill `min-h-11` already meets the floor at any density; this story exists to verify nothing regresses when the host adds `.density-accessible`.',
      },
    },
  },
};
