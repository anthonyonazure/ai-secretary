/**
 * Mobile AcceptInviteForm — pure-logic tests (Story 1.5d).
 *
 * The mobile vitest config runs under node with no RN renderer.
 * Visual rendering lives in Storybook stories. We assert the wire
 * contract (zod schema parses exactly what the form submits) here.
 */

import { acceptInviteRequestSchema } from '@aisecretary/shared/schemas/invites';
import { describe, expect, it } from 'vitest';

describe('AcceptInviteForm — wire contract', () => {
  it('accepts a valid (token, password, name) tuple', () => {
    const result = acceptInviteRequestSchema.safeParse({
      token: 'abc123',
      password: 'long-enough-password',
      name: 'New Member',
    });
    expect(result.success).toBe(true);
  });

  it('rejects passwords shorter than 12 chars', () => {
    const result = acceptInviteRequestSchema.safeParse({
      token: 'abc123',
      password: 'short',
      name: 'A',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/at least 12 characters/i);
    }
  });

  it('rejects empty name', () => {
    const result = acceptInviteRequestSchema.safeParse({
      token: 'abc123',
      password: 'long-enough-password',
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty token', () => {
    const result = acceptInviteRequestSchema.safeParse({
      token: '',
      password: 'long-enough-password',
      name: 'A',
    });
    expect(result.success).toBe(false);
  });
});
