import type { Meta, StoryObj } from '@storybook/react';

import { LiveCaptions } from './live-captions';

/**
 * Storybook stories for Story 4.6 captions. The hook calls the browser
 * SpeechRecognition API which doesn't work inside the Storybook iframe
 * for most headless-browser setups; the unsupported-state story is the
 * only meaningful preview without a real microphone permission grant.
 *
 * Visually verify the layout in the active state by recording a real
 * meeting in the local dev server.
 */

const meta: Meta<typeof LiveCaptions> = {
  title: 'Feature/Recording/LiveCaptions',
  component: LiveCaptions,
  parameters: {
    docs: {
      description: {
        component:
          'Live-captions strip rendered during recording for deaf / HoH accessibility. Wraps `useLiveCaptions()` which uses the browser SpeechRecognition API today; swaps to the streaming-transcription path when that ships.',
      },
    },
  },
  args: {
    active: true,
  },
};
export default meta;

type Story = StoryObj<typeof LiveCaptions>;

export const Active: Story = {};

export const Inactive: Story = {
  args: { active: false },
  parameters: {
    docs: {
      description: {
        story: 'When `active` is false, the component renders nothing.',
      },
    },
  },
};
