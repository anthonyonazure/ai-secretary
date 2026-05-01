import type { Meta, StoryObj } from '@storybook/react';
import { AuthFetchError } from '../../../lib/auth/auth-fetch';
import { SignupForm } from './signup-form';

const meta: Meta<typeof SignupForm> = {
  title: 'Feature/Auth/SignupForm',
  component: SignupForm,
  parameters: { layout: 'centered' },
  args: {
    onSubmit: async () => undefined,
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SignupForm>;

export const Default: Story = {};

export const Submitting: Story = {
  args: { isSubmitting: true },
};

export const ServerError: Story = {
  args: {
    serverError: new AuthFetchError('Email is already in use', 409, {
      title: 'Conflict',
      detail: 'Email is already in use',
      requestId: 'req_demo',
      errors: { '/email': ['Email is already in use'] },
    }),
  },
};

export const WithSwitchLink: Story = {
  args: {
    onSwitchToLogin: () => undefined,
  },
};
