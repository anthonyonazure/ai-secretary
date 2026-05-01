import type { Meta, StoryObj } from '@storybook/react';
import { AuthFetchError } from '../../../lib/auth/auth-fetch';
import { LoginForm } from './login-form';

const meta: Meta<typeof LoginForm> = {
  title: 'Feature/Auth/LoginForm',
  component: LoginForm,
  parameters: { layout: 'centered' },
  args: {
    onSubmit: async () => undefined,
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof LoginForm>;

export const Default: Story = {};

export const Submitting: Story = {
  args: { isSubmitting: true },
};

export const ServerError: Story = {
  args: {
    serverError: new AuthFetchError('Invalid email or password', 401, {
      title: 'Unauthorized',
      detail: 'Invalid email or password',
      requestId: 'req_demo',
    }),
  },
};

export const WithSwitchLink: Story = {
  args: {
    onSwitchToSignup: () => undefined,
  },
};
