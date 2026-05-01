import type { Meta, StoryObj } from '@storybook/react';

import { AuthFetchError } from '../../../lib/auth/auth-fetch';
import { AuthError } from './auth-error';

const meta: Meta<typeof AuthError> = {
  title: 'Feature/Auth/AuthError',
  component: AuthError,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Reusable RFC-7807 problem-details banner used across auth surfaces. Renders title + detail + requestId; falls back to a generic message for unknown errors.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AuthError>;

const problemError = new AuthFetchError('Invalid credentials', 401, {
  type: 'about:blank',
  title: 'Invalid credentials',
  status: 401,
  detail: 'The email or password you entered is incorrect.',
  requestId: 'req_abc123',
});

const networkError = new Error('Failed to fetch');

export const ProblemDetails: Story = {
  args: { error: problemError },
};

export const NetworkError: Story = {
  args: { error: networkError },
};

export const UnknownError: Story = {
  args: { error: { something: 'opaque' } },
};

export const MessageOverride: Story = {
  args: {
    error: problemError,
    message: 'We couldn’t sign you in. Try again in a moment.',
  },
};

export const Hidden: Story = {
  args: { error: null },
  parameters: {
    docs: { story: 'Renders nothing when neither error nor message is provided.' },
  },
};
