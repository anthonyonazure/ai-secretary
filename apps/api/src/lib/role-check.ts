/**
 * `requireRole` preHandler — Story 1.5d.
 *
 * Lightweight role gate for routes that should only be reachable by a
 * specific subset of authenticated users (e.g. tenant-admin invite
 * management).
 *
 * Roles are platform-wide identifiers from the `user_role` enum
 * (`super_admin` | `org_admin` | `org_member` | `org_viewer`). The
 * `users.role` column is the source of truth and is reflected on every
 * verified JWT claim via `request.user.role`.
 *
 * Usage:
 *
 *   fastify.post('/some-admin-route', {
 *     preHandler: [requireRole(['org_admin'])],
 *   }, handler);
 *
 *   // Multiple roles — any match passes:
 *   preHandler: [requireRole(['super_admin', 'org_admin'])]
 *
 * Failure modes:
 *   - No `request.user`         → 401 UnauthorizedError
 *   - Role not in allowed list  → 403 ForbiddenError
 *
 * The preHandler runs AFTER the JWT plugin has populated
 * `request.user`. It does NOT require tenant-context (the role is on
 * the JWT claim itself). It DOES require an authenticated session;
 * routes that are entirely public should not use this gate.
 */

import type { UserRole } from '@aisecretary/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError, UnauthorizedError } from './http-error.js';

export type RoleCheckHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> | void;

/**
 * Build a Fastify preHandler that allows the request through only
 * when `request.user.role` is one of the supplied `allowed` roles.
 */
export const requireRole = (allowed: readonly UserRole[]): RoleCheckHandler => {
  if (allowed.length === 0) {
    // Defensive: an empty allow-list would lock everyone out, which is
    // almost certainly a developer mistake.
    throw new Error('requireRole: at least one allowed role is required');
  }
  const allowedSet: ReadonlySet<UserRole> = new Set(allowed);

  return async (request: FastifyRequest): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required.');
    }
    if (!allowedSet.has(request.user.role)) {
      throw new ForbiddenError('Insufficient role for this action.');
    }
  };
};
