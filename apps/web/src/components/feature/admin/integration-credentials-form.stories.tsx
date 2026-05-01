import type { Meta, StoryObj } from '@storybook/react';

import { IntegrationCredentialsForm } from './integration-credentials-form';

const meta: Meta<typeof IntegrationCredentialsForm> = {
  title: 'Feature/Admin/IntegrationCredentialsForm',
  component: IntegrationCredentialsForm,
  parameters: {
    docs: {
      description: {
        component:
          'Stories 9.1 + 9.2 admin form for Zoom S2S OAuth + Microsoft Teams app-only Graph credentials. Secrets render as password inputs with a Show/Hide eye toggle; once persisted, the form gates new edits behind an explicit "Replace" CTA.',
      },
    },
  },
  args: {
    onSave: () => undefined,
    onDisconnect: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof IntegrationCredentialsForm>;

export const ZoomEmpty: Story = {
  args: { provider: 'zoom', hasExistingCredentials: false },
};

export const TeamsEmpty: Story = {
  args: { provider: 'teams', hasExistingCredentials: false },
};

export const ZoomConfigured: Story = {
  args: { provider: 'zoom', hasExistingCredentials: true },
  parameters: {
    docs: {
      description: {
        story:
          'Existing credentials gate the form behind a "Replace" CTA — a deliberate friction step.',
      },
    },
  },
};

export const ZoomSaving: Story = {
  args: { provider: 'zoom', hasExistingCredentials: false, isPending: true },
};
