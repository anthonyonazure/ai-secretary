import type { Meta, StoryObj } from '@storybook/react';

import { ConsentQrCard } from './consent-qr-card';

const meta: Meta<typeof ConsentQrCard> = {
  title: 'Feature/Recording/ConsentQrCard',
  component: ConsentQrCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Story 4.3 — in-person consent shape C. Renders a QR for a counterpart to scan + a live acknowledgment list. Story 1.4 follow-up wires the real polling endpoint.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ConsentQrCard>;

const baseToken = 'sample-ack-token-1234';

export const Empty: Story = {
  args: {
    ackToken: baseToken,
    origin: 'https://acme.us.aisecretary.app',
    loadAcknowledgments: async () => [],
  },
};

export const WithAcknowledgments: Story = {
  args: {
    ackToken: baseToken,
    origin: 'https://acme.us.aisecretary.app',
    loadAcknowledgments: async () => [
      {
        id: 'a-1',
        recipientLabel: 'Dana',
        acknowledgedAt: new Date(Date.now() - 60_000).toISOString(),
      },
      {
        id: 'a-2',
        recipientLabel: 'Mara',
        acknowledgedAt: new Date(Date.now() - 30_000).toISOString(),
      },
    ],
  },
};

export const ReducedMotion: Story = {
  args: {
    ackToken: baseToken,
    origin: 'https://acme.us.aisecretary.app',
    loadAcknowledgments: async () => [],
  },
  decorators: [
    (StoryFn) => (
      <div className="motion-reduced">
        <StoryFn />
      </div>
    ),
  ],
};

export const DarkTheme: Story = {
  args: {
    ackToken: baseToken,
    origin: 'https://acme.eu.aisecretary.app',
    loadAcknowledgments: async () => [
      {
        id: 'a-1',
        recipientLabel: 'Hans',
        acknowledgedAt: new Date(Date.now() - 12_000).toISOString(),
      },
    ],
  },
  decorators: [
    (StoryFn) => (
      <div className="theme-dark">
        <StoryFn />
      </div>
    ),
  ],
};
