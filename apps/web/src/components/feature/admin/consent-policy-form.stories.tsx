import type { Meta, StoryObj } from '@storybook/react';

import { ConsentPolicyForm } from './consent-policy-form';

const meta: Meta<typeof ConsentPolicyForm> = {
  title: 'Feature/Admin/ConsentPolicyForm',
  component: ConsentPolicyForm,
  parameters: {
    docs: {
      description: {
        component:
          'Story 12.6 admin form. Sets the tenant default for legal-basis (explicit-per-participant for EU + strict tenants; legitimate-interest elsewhere) + opt-out behavior (auto-quarantine vs per-participant exclusion). Per ADR-0005, the most-protective rule wins — admin defaults are the floor, never the ceiling.',
      },
    },
  },
  args: {
    onSave: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof ConsentPolicyForm>;

export const EuStrict: Story = {
  args: {
    value: {
      legalBasis: 'explicit-per-participant',
      optOutBehavior: 'auto-quarantine',
    },
  },
};

export const UsLegitimateInterest: Story = {
  args: {
    value: {
      legalBasis: 'legitimate-interest-implicit',
      optOutBehavior: 'per-participant-exclusion',
    },
  },
};

export const Saving: Story = {
  args: {
    value: {
      legalBasis: 'explicit-per-participant',
      optOutBehavior: 'auto-quarantine',
    },
    isPending: true,
  },
};
