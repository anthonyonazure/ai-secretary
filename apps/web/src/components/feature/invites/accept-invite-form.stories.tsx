import type { InviteLookupResponse } from '@aisecretary/shared/schemas/invites';
import type { Meta, StoryObj } from '@storybook/react';
import { AuthFetchError } from '../../../lib/auth/auth-fetch';
import { AcceptInviteForm } from './accept-invite-form';

const lookup: InviteLookupResponse = {
  email: 'newmember@acme.test',
  tenantName: 'Acme Inc',
  inviterName: 'Admin User',
  role: 'org_member',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

const meta: Meta<typeof AcceptInviteForm> = {
  title: 'Feature/Invites/AcceptInviteForm',
  component: AcceptInviteForm,
  parameters: { layout: 'centered' },
  args: {
    lookup,
    token: 'demo-token-base64url',
    onSubmit: async () => undefined,
  },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof AcceptInviteForm>;

export const Default: Story = {};

export const Submitting: Story = { args: { isSubmitting: true } };

export const ServerError: Story = {
  args: {
    serverError: new AuthFetchError('This invite has expired.', 410, {
      title: 'Gone',
      detail: 'This invite has expired.',
      requestId: 'req_demo',
    }),
  },
};
