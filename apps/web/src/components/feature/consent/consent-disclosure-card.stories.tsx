import type { Meta, StoryObj } from '@storybook/react';

import { ConsentDisclosureCard } from './consent-disclosure-card';

const meta: Meta<typeof ConsentDisclosureCard> = {
  title: 'Feature/Consent/ConsentDisclosureCard',
  component: ConsentDisclosureCard,
  parameters: {
    docs: {
      description: {
        component:
          'Story 14.6 disclosure artifact — three variants render the same body for different contexts: inline (F2 pre-recording), screenshare (large-text in-person clinical), link (public token URL). Plain-language register per UX spec § Step 11 (GOV.UK style).',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof ConsentDisclosureCard>;

export const InlineDefault: Story = {
  args: {
    variant: 'inline',
    organizationName: 'Acme Health',
    disclosureText:
      "We're recording this visit so your clinician can focus on you. Your audio + transcript stay inside our practice and are deleted after 90 days.",
    retentionSummary: '90 days',
    regionLabel: 'United States',
  },
};

export const ScreenshareClinical: Story = {
  args: {
    variant: 'screenshare',
    organizationName: 'Acme Health',
    disclosureText:
      "We're recording this visit so your clinician can focus on you. Your audio + transcript stay inside our practice and are deleted after 90 days.",
    retentionSummary: '90 days',
    regionLabel: 'United States',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Large-text view a provider screen-shares with the patient on a tablet. Touch targets remain at 44px+; line height is generous to support glance-and-go reading.',
      },
    },
  },
};

export const LinkPublic: Story = {
  args: {
    variant: 'link',
    organizationName: 'Acme Health',
    disclosureText:
      'Acme Health uses AI Secretary to record + transcribe meetings. This page explains exactly what we collect, where it lives, and how to remove it.',
    retentionSummary: '90 days',
    regionLabel: 'United States',
  },
};

export const WithAcknowledgment: Story = {
  args: {
    variant: 'inline',
    organizationName: 'Acme Health',
    disclosureText:
      'Recording will start once you tap "I acknowledge" below. You can stop the recording at any time.',
    acknowledgment: (
      <button
        type="button"
        className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-bg"
      >
        I acknowledge
      </button>
    ),
  },
};
