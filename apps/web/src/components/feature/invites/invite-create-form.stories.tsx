import type { Meta, StoryObj } from '@storybook/react';
import { AuthFetchError } from '../../../lib/auth/auth-fetch';
import { InviteCreateForm } from './invite-create-form';

const meta: Meta<typeof InviteCreateForm> = {
  title: 'Feature/Invites/InviteCreateForm',
  component: InviteCreateForm,
  parameters: { layout: 'centered' },
  args: { onSubmit: async () => undefined },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof InviteCreateForm>;

export const Default: Story = {};

export const Submitting: Story = { args: { isSubmitting: true } };

export const ServerConflict: Story = {
  args: {
    serverError: new AuthFetchError('An open invite already exists for this email.', 409, {
      title: 'Conflict',
      detail: 'An open invite already exists for this email.',
      requestId: 'req_demo',
    }),
  },
};
