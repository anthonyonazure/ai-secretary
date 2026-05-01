import type { Meta, StoryObj } from '@storybook/react';

import { CaptureAtRiskBanner } from './capture-at-risk-banner';

const meta: Meta<typeof CaptureAtRiskBanner> = {
  title: 'Feature/Recording/CaptureAtRiskBanner',
  component: CaptureAtRiskBanner,
  parameters: {
    docs: {
      description: {
        component:
          'Story 4.4 — the ONE assertive surface in the app (role="alert" + aria-live="assertive"). Renders when the watchdog detects a lost heartbeat; surfaces three CTAs (continue / pause / stop) without locking the user out. Anti-pattern guard: notification-anxiety pattern is dismissible per-instance.',
      },
    },
  },
  args: {
    onContinue: () => undefined,
    onPause: () => undefined,
    onStop: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof CaptureAtRiskBanner>;

export const JustTriggered: Story = {
  args: { secondsSinceLastPing: 95 },
  parameters: {
    docs: {
      description: {
        story:
          'Just past the 90s threshold — copy reads "just now" so the user knows it\'s recent.',
      },
    },
  },
};

export const FewMinutes: Story = {
  args: { secondsSinceLastPing: 6 * 60 },
};

export const Dismissible: Story = {
  args: { secondsSinceLastPing: 95, onDismiss: () => undefined },
};
