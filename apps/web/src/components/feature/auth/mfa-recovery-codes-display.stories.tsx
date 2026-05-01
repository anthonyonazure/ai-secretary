import type { Meta, StoryObj } from '@storybook/react';
import { MfaRecoveryCodesDisplay } from './mfa-recovery-codes-display';

const meta: Meta<typeof MfaRecoveryCodesDisplay> = {
  title: 'Feature/Auth/MfaRecoveryCodesDisplay',
  component: MfaRecoveryCodesDisplay,
  parameters: { layout: 'centered' },
  args: {
    recoveryCodes: [
      'a1b2-c3d4-e5f6',
      '1111-2222-3333',
      '4444-5555-6666',
      '7777-8888-9999',
      'aaaa-bbbb-cccc',
      'dddd-eeee-ffff',
      '0123-4567-89ab',
      'cdef-0123-4567',
      '89ab-cdef-0123',
      '4567-89ab-cdef',
    ],
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MfaRecoveryCodesDisplay>;

export const Default: Story = {};

export const WithAcknowledge: Story = {
  args: {
    onAcknowledge: () => undefined,
  },
};
