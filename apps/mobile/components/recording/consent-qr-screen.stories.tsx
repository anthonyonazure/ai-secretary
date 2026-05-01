import type { Meta, StoryObj } from '@storybook/react';

import { ConsentQrScreen } from './consent-qr-screen';

const meta: Meta<typeof ConsentQrScreen> = {
  title: 'Feature/Recording/ConsentQrScreen',
  component: ConsentQrScreen,
};

export default meta;
type Story = StoryObj<typeof ConsentQrScreen>;

export const Empty: Story = {
  args: {
    ackToken: 'sample-ack-token-1234',
    origin: 'https://acme.us.aisecretary.app',
    loadAcknowledgments: async () => [],
  },
};

export const WithAcknowledgments: Story = {
  args: {
    ackToken: 'sample-ack-token-1234',
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
