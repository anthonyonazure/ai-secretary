/**
 * Mobile InviteCreateForm — pure-logic tests (Story 1.5d).
 *
 * Asserts the schema accepts/rejects the payloads the form produces.
 * Visual rendering lives in Storybook stories.
 */

import { createInviteRequestSchema } from '@aisecretary/shared/schemas/invites';
import { describe, expect, it } from 'vitest';

describe('InviteCreateForm — wire contract', () => {
  it('accepts a minimal (email, role) payload', () => {
    const result = createInviteRequestSchema.safeParse({
      email: 'a@acme.test',
      role: 'org_member',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a full (email, role, ttlDays) payload', () => {
    const result = createInviteRequestSchema.safeParse({
      email: 'a@acme.test',
      role: 'org_admin',
      ttlDays: 14,
    });
    expect(result.success).toBe(true);
  });

  it('rejects ttlDays > 30', () => {
    const result = createInviteRequestSchema.safeParse({
      email: 'a@acme.test',
      role: 'org_member',
      ttlDays: 99,
    });
    expect(result.success).toBe(false);
  });

  it('rejects super_admin role', () => {
    const result = createInviteRequestSchema.safeParse({
      email: 'a@acme.test',
      role: 'super_admin',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = createInviteRequestSchema.safeParse({
      email: 'not-an-email',
      role: 'org_member',
    });
    expect(result.success).toBe(false);
  });
});
