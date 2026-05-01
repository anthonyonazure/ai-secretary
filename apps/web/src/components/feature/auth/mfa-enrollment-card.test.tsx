/// <reference lib="dom" />

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MfaEnrollmentCard } from './mfa-enrollment-card';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,FAKE') },
}));

const recoveryCodes = [
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
];

describe('MfaEnrollmentCard (Story 1.5c)', () => {
  it('renders the manual secret + recovery codes', async () => {
    render(
      <MfaEnrollmentCard
        otpauthUri="otpauth://totp/Test:a@b.test?secret=JBSWY3DPEHPK3PXP&issuer=Test"
        secret="JBSWY3DPEHPK3PXP"
        recoveryCodes={recoveryCodes}
        onConfirm={async () => undefined}
      />,
    );
    expect(screen.getByTestId('mfa-enrollment-secret')).toHaveTextContent('JBSWY3DPEHPK3PXP');
    for (const code of recoveryCodes) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }
  });

  it('renders the QR image after async generation', async () => {
    render(
      <MfaEnrollmentCard
        otpauthUri="otpauth://totp/Test:a@b.test?secret=JBSWY3DPEHPK3PXP&issuer=Test"
        secret="JBSWY3DPEHPK3PXP"
        recoveryCodes={recoveryCodes}
        onConfirm={async () => undefined}
      />,
    );
    await waitFor(() => {
      expect(screen.getByAltText(/scan with your authenticator app/i)).toBeInTheDocument();
    });
  });
});
