import type { Meta, StoryObj } from '@storybook/react';
import { MfaEnrollmentCard } from './mfa-enrollment-card';

const meta: Meta<typeof MfaEnrollmentCard> = {
  title: 'Feature/Auth/MfaEnrollmentCard',
  component: MfaEnrollmentCard,
  parameters: { layout: 'centered' },
  args: {
    otpauthUri:
      'otpauth://totp/AI%20Secretary:jane%40acme.test?secret=JBSWY3DPEHPK3PXP&issuer=AI%20Secretary',
    secret: 'JBSWY3DPEHPK3PXP',
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
    onConfirm: async () => undefined,
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MfaEnrollmentCard>;

export const Default: Story = {};

export const Submitting: Story = {
  args: { isSubmitting: true },
};
