import type { Meta, StoryObj } from '@storybook/react';

import { UploadRetryBanner } from './upload-retry-banner';

const meta: Meta<typeof UploadRetryBanner> = {
  title: 'Feature/Recording/UploadRetryBanner',
  component: UploadRetryBanner,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Story 4.5 — escalation surface shown after the 10-min retry budget elapses. Three actions: retry / upload-manually / contact-support.',
      },
    },
  },
  args: {
    recordingId: '00000000-0000-0000-0000-000000000001',
    onRetry: () => undefined,
    onUploadManually: () => undefined,
    autoFocus: false,
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof UploadRetryBanner>;

export const Default: Story = {};

export const WithLastError: Story = {
  args: {
    lastErrorMessage: 'Connection reset by peer',
  },
};

export const Submitting: Story = {
  args: {
    onRetry: () => {
      // Storybook stub — production wires this to the resumable-upload hook.
    },
  },
};

export const Discarded: Story = {
  args: {
    lastErrorMessage: 'User discarded — recording deleted from device',
  },
};
