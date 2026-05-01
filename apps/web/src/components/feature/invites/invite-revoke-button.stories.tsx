import type { Meta, StoryObj } from '@storybook/react';

import { InviteRevokeButton } from './invite-revoke-button';

const meta: Meta<typeof InviteRevokeButton> = {
  title: 'Feature/Invites/InviteRevokeButton',
  component: InviteRevokeButton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Story 1.5d invite revocation. Confirms via window.confirm before firing — revoke is permanent (recipient gets 410 Gone next time they try to accept).',
      },
    },
  },
  args: {
    inviteId: 'inv-1',
    onRevoke: async () => {},
  },
};

export default meta;
type Story = StoryObj<typeof InviteRevokeButton>;

export const Idle: Story = {
  args: { isRevoking: false },
};

export const Revoking: Story = {
  args: { isRevoking: true },
};
