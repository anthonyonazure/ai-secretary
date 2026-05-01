import type { Meta, StoryObj } from '@storybook/react';

import { PricingGrid } from './pricing-grid';

/**
 * Storybook stories for the Story 13.4 / 13.5 PricingGrid.
 */
const meta: Meta<typeof PricingGrid> = {
  title: 'Feature/Billing/PricingGrid',
  component: PricingGrid,
  parameters: {
    docs: {
      description: {
        component:
          'Four-tier billing comparison table sourced from `packages/shared/src/billing/tiers.ts`. The "current plan" tier is highlighted; recommended tier (Pro) gets the visual pop. Anti-pattern guard per UX spec § Step 5 #2: no "free-tier asterisk hell" or scarcity pressure.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof PricingGrid>;

export const Default: Story = {};

export const ProCustomer: Story = {
  args: { currentTierId: 'pro' },
  parameters: {
    docs: {
      description: {
        story: 'Pro tenant viewing the page — Pro tier shows the "Current plan" CTA disabled.',
      },
    },
  },
};

export const FreeCustomer: Story = {
  args: { currentTierId: 'free' },
  parameters: {
    docs: {
      description: {
        story: 'Free tenant viewing the page — every paid tier surfaces an upgrade CTA.',
      },
    },
  },
};

export const EnterpriseCustomer: Story = {
  args: { currentTierId: 'enterprise' },
  parameters: {
    docs: {
      description: {
        story:
          'Enterprise tenant — every other tier looks like a downgrade. CTA copy stays neutral.',
      },
    },
  },
};
