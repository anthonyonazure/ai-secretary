import type { Meta, StoryObj } from '@storybook/react';

import { ConsentModal } from './consent-modal';

const meta: Meta<typeof ConsentModal> = {
  title: 'Feature/Recording/ConsentModal',
  component: ConsentModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Story 4.3 — pre-mic consent shape A. Renders the org-configurable disclosure plus the EU explicit-consent branch. Replaces ConsentModalStub.',
      },
    },
  },
  args: {
    open: true,
    onAcknowledge: () => undefined,
    onDecline: () => undefined,
  },
  tags: ['autodocs'],
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
      'Veridian Health retains clinical recordings for seven years per state regulation. Recordings are encrypted at rest and accessible only to your care team.',
  },
};

export const ReducedMotion: Story = {
  args: { legalBasis: 'legitimate-interest' },
  parameters: {
    docs: {
      description: {
        story:
          'Reduced-motion mode is driven by the host class `motion-reduced` on a parent. The modal disables backdrop blur in that mode.',
      },
    },
  },
  decorators: [
    (StoryFn) => (
      <div className="motion-reduced">
        <StoryFn />
      </div>
    ),
  ],
};

export const DarkTheme: Story = {
  args: { legalBasis: 'legitimate-interest' },
  decorators: [
    (StoryFn) => (
      <div className="theme-dark">
        <StoryFn />
      </div>
    ),
  ],
};
