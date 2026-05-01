import type { Meta, StoryObj } from '@storybook/react';

import { RetentionPolicyForm } from './retention-policy-form';

const meta: Meta<typeof RetentionPolicyForm> = {
  title: 'Feature/Admin/RetentionPolicyForm',
  component: RetentionPolicyForm,
  parameters: {
    docs: {
      description: {
        component:
          'Story 12.3 admin form for the per-tenant retention policy. Drives the nightly retention-purge worker. Audio retention cannot exceed transcript retention; minimum 30 days for Pro / Free, 1 day for Enterprise overrides.',
      },
    },
  },
  args: {
    onSave: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof RetentionPolicyForm>;

export const ProDefaults: Story = {
  args: { value: { audioDays: 365, transcriptDays: 365 } },
};

export const BusinessDefaults: Story = {
  args: { value: { audioDays: 90, transcriptDays: 365 } },
};

export const EnterpriseLowFloor: Story = {
  args: {
    value: { audioDays: 7, transcriptDays: 7 },
    minDays: 1,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Enterprise plans can override the floor to 1 day for short-retention data residency.',
      },
    },
  },
};

export const Saving: Story = {
  args: {
    value: { audioDays: 90, transcriptDays: 365 },
    isPending: true,
  },
};
