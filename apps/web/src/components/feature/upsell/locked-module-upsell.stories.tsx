import type { Meta, StoryObj } from '@storybook/react';

import { LockedModuleUpsell } from './locked-module-upsell';

const meta: Meta<typeof LockedModuleUpsell> = {
  title: 'Feature/Upsell/LockedModuleUpsell',
  component: LockedModuleUpsell,
  parameters: {
    docs: {
      description: {
        component:
          'Renders inline when the entitlement-check plugin returns 403 with the `upsell.module` extension. UX spec § Step 5 #9 forbids "AI as feature, not substrate"; this card is calm, plain-language, and dismissible.',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof LockedModuleUpsell>;

export const MedicalOnBusiness: Story = {
  args: {
    feature: 'medical',
    featureLabel: 'The medical module',
    minimumTier: 'business',
    description: 'HIPAA-eligible routing requires the Business tier or higher.',
  },
};

export const BotOnPro: Story = {
  args: {
    feature: 'bot',
    featureLabel: 'Meeting bot',
    minimumTier: 'pro',
    description:
      'Connect a Zoom or Microsoft Teams account so AI Secretary can join meetings on your behalf.',
  },
};

export const Dismissible: Story = {
  args: {
    feature: 'cross-org-sharing',
    featureLabel: 'Cross-org sharing',
    minimumTier: 'pro',
    onDismiss: () => undefined,
  },
};
