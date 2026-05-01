import type { Meta, StoryObj } from '@storybook/react';
import { AuthFetchError } from '../../../lib/auth/auth-fetch';
import { MfaChallengeForm } from './mfa-challenge-form';

const meta: Meta<typeof MfaChallengeForm> = {
  title: 'Feature/Auth/MfaChallengeForm',
  component: MfaChallengeForm,
  parameters: { layout: 'centered' },
  args: {
    challengeToken: 'demo-challenge-token',
    onSubmit: async () => undefined,
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MfaChallengeForm>;

export const Default: Story = {};

export const Submitting: Story = {
  args: { isSubmitting: true },
};

export const InvalidCode: Story = {
  args: {
    serverError: new AuthFetchError('Invalid MFA code', 401, {
      title: 'Unauthorized',
      detail: 'Invalid MFA code',
      requestId: 'req_demo',
    }),
  },
};

export const RateLimited: Story = {
  args: {
    serverError: new AuthFetchError('Too many failed MFA attempts', 429, {
      title: 'Too Many Requests',
      detail: 'Too many failed MFA attempts. Try again in 15 minutes.',
      requestId: 'req_demo',
    }),
  },
};

export const ForcedEnrollment: Story = {
  args: { hideRecoveryToggle: true },
};
