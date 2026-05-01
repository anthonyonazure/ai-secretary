/**
 * Story 1.5d — `requireRole` unit tests.
 *
 * The preHandler is exercised in isolation here; the route-integration
 * tests in `routes/invites.test.ts` cover the wiring through Fastify.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { ForbiddenError, UnauthorizedError } from './http-error.js';
import { requireRole } from './role-check.js';

const fakeReply = {} as unknown as FastifyReply;

const makeRequest = (
  user: { role: 'super_admin' | 'org_admin' | 'org_member' | 'org_viewer' } | null,
): FastifyRequest =>
  ({
    user: user
      ? {
          tenantId: '00000000-0000-0000-0000-000000000001',
          userId: '00000000-0000-0000-0000-000000000002',
          region: 'us',
          role: user.role,
        }
      : null,
  }) as unknown as FastifyRequest;

describe('requireRole', () => {
  it('allows the request through when role matches', async () => {
    const handler = requireRole(['org_admin']);
    await expect(handler(makeRequest({ role: 'org_admin' }), fakeReply)).resolves.toBeUndefined();
  });

  it('allows when any of multiple allowed roles match', async () => {
    const handler = requireRole(['super_admin', 'org_admin']);
    await expect(handler(makeRequest({ role: 'super_admin' }), fakeReply)).resolves.toBeUndefined();
    await expect(handler(makeRequest({ role: 'org_admin' }), fakeReply)).resolves.toBeUndefined();
  });

  it('throws ForbiddenError when role is not allowed', async () => {
    const handler = requireRole(['org_admin']);
    await expect(handler(makeRequest({ role: 'org_member' }), fakeReply)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('throws UnauthorizedError when no user is set', async () => {
    const handler = requireRole(['org_admin']);
    await expect(handler(makeRequest(null), fakeReply)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws on construction when allow-list is empty', () => {
    expect(() => requireRole([])).toThrow(/at least one allowed role/);
  });
});
