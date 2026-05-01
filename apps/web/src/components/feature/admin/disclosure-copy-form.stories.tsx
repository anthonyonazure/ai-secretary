import type { Meta, StoryObj } from '@storybook/react';

import { DisclosureCopyForm } from './disclosure-copy-form';

const meta: Meta<typeof DisclosureCopyForm> = {
  title: 'Feature/Admin/DisclosureCopyForm',
  component: DisclosureCopyForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Story 12.4 admin form (FR45 + FR46 + FR47). Three plain-language disclosure copy fields, an in-person 3rd-party consent toggle, and a read-only region pin — region is immutable after F2-admin region-pin per ADR-0004.',
      },
    },
  },
  args: {
    onSave: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof DisclosureCopyForm>;

const SAMPLE_VALUE = {
  preMic:
    'AI Secretary will record this meeting and turn it into a transcript and summary you can revisit. Recording is local to your tenant and can be revoked at any time.',
  botAnnouncement:
    'Hi everyone, AI Secretary has joined to record and transcribe this meeting for the host. The disclosure URL will be posted in the chat.',
  patientArtifact:
    'Your clinician is using AI Secretary to take session notes. The recording stays inside your clinician’s account and is not shared outside this practice.',
  inPersonConsentRequired: false,
};

export const UsRegionPinned: Story = {
  args: {
    value: SAMPLE_VALUE,
    region: 'us',
    regionPinned: true,
  },
};

export const EuRegionPinned: Story = {
  args: {
    value: { ...SAMPLE_VALUE, inPersonConsentRequired: true },
    region: 'eu',
    regionPinned: true,
  },
};

export const NotYetPinned: Story = {
  args: {
    value: SAMPLE_VALUE,
    region: 'us',
    regionPinned: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Pre-F2-admin state — the region pin row notes that pinning has not happened yet.',
      },
    },
  },
};

export const SavingInflight: Story = {
  args: {
    value: SAMPLE_VALUE,
    region: 'us',
    regionPinned: true,
    isPending: true,
  },
};
