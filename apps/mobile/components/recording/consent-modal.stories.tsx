import type { Meta, StoryObj } from '@storybook/react';

import { ConsentModal } from './consent-modal';

const meta: Meta<typeof ConsentModal> = {
  title: 'Feature/Recording/ConsentModal',
  component: ConsentModal,
  args: {
    open: true,
    onAcknowledge: () => undefined,
    onDecline: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof ConsentModal>;

export const LegitimateInterest: Story = {
  args: {
    legalBasis: 'legitimate-interest',
    orgName: 'Acme Therapy',
  },
};

export const ExplicitConsent: Story = {
  args: {
    legalBasis: 'explicit-consent',
    orgName: 'Acme Therapy EU',
  },
};

export const OrgOverrideWithCustomDisclosure: Story = {
  args: {
    legalBasis: 'explicit-consent',
    orgName: 'Veridian Health',
    customDisclosure:
      'Veridian Health retains clinical recordings for seven years. Recordings are encrypted at rest and accessible only to your care team.',
  },
};
