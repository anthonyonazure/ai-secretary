/**
 * Mobile MfaChallengeForm — pure-logic tests (Story 1.5c).
 *
 * Mirrors the pattern in `components/invites/invite-list.test.ts`:
 * the mobile vitest setup runs under node without a react-native
 * renderer, so visual states are exercised in Storybook stories. Pure
 * logic — the wire-contract validation + recovery-code shape — is
 * testable here.
 */

import { verifyMfaRequestSchema } from '@aisecretary/shared/schemas/auth';
import { describe, expect, it } from 'vitest';

describe('MfaChallengeForm — verifyMfaRequestSchema (Story 1.5c)', () => {
  it('accepts a 6-digit TOTP code', () => {
    const out = verifyMfaRequestSchema.safeParse({
      challengeToken: 'ct',
      code: '123456',
    });
    expect(out.success).toBe(true);
  });

  it('accepts a recovery code (4-4-4 hex)', () => {
    const out = verifyMfaRequestSchema.safeParse({
      challengeToken: 'ct',
      code: 'a1b2-c3d4-e5f6',
    });
    expect(out.success).toBe(true);
  });

  it('rejects too-short codes', () => {
    const out = verifyMfaRequestSchema.safeParse({ challengeToken: 'ct', code: '12345' });
    expect(out.success).toBe(false);
  });

  it('rejects too-long codes (over 20 chars)', () => {
    const out = verifyMfaRequestSchema.safeParse({
      challengeToken: 'ct',
      code: 'a'.repeat(21),
    });
    expect(out.success).toBe(false);
  });

  it('rejects an empty challenge token', () => {
    const out = verifyMfaRequestSchema.safeParse({ challengeToken: '', code: '123456' });
    expect(out.success).toBe(false);
  });
});
