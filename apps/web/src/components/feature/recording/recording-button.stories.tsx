import type { Meta, StoryObj } from '@storybook/react';

import { RecordingButton } from './recording-button';

const meta: Meta<typeof RecordingButton> = {
  title: 'Feature/Recording/RecordingButton',
  component: RecordingButton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One-tap recording entry — visual companion to RecordingStatusPill. Drives the FR6/FR7 entry path; consent gating ships in Story 4.3.',
      },
    },
  },
  args: {
    onStart: () => undefined,
    onStop: () => undefined,
    onRetry: () => undefined,
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RecordingButton>;

export const Idle: Story = {
  args: { state: { kind: 'idle' } },
};

export const RequestingConsent: Story = {
  args: { state: { kind: 'requesting-consent' } },
};

export const Recording: Story = {
  args: { state: { kind: 'recording', startedAt: Date.now() } },
};

export const Paused: Story = {
  args: { state: { kind: 'paused', startedAt: Date.now() - 30_000, pausedAt: Date.now() } },
};

export const Stopping: Story = {
  args: { state: { kind: 'stopping' } },
};

export const Uploading: Story = {
  args: { state: { kind: 'uploading', recordingId: 'demo', progress: 0.42 } },
};

export const ErrorRetryable: Story = {
  args: { state: { kind: 'error', reason: 'Network unavailable', retryable: true } },
};

export const ErrorTerminal: Story = {
  args: { state: { kind: 'error', reason: 'Mic permission denied', retryable: false } },
};
