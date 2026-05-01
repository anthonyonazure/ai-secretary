/**
 * Invites routes — Story 1.5d.
 *
 * Two mounted route groups (one plugin instance — wired together so the
 * unauthenticated public routes opt out of `tenant-context` while the
 * admin routes inherit it):
 *
 *   Admin (authenticated, org_admin / super_admin only):
 *     POST   /api/v1/tenants/:tenantId/invites
 *     GET    /api/v1/tenants/:tenantId/invites
 *     DELETE /api/v1/tenants/:tenantId/invites/:id
 *
 *   Public (unauthenticated, token in URL):
 *     GET    /api/v1/invites/:token
 *     POST   /api/v1/invites/:token/accept
 *
 * Token discipline:
 *   The plaintext token is 32 random bytes (`crypto.randomBytes(32)`)
 *   encoded as base64url (43 chars). It only ever lives inside the
 *   dispatched email + the URL the recipient lands on. The DB stores
 *   `sha256(token)` hex; lookups hash the supplied token and compare.
 *
 * Email dispatch:
 *   On invite create, we enqueue a `notification.send` job via the
 *   `notificationEnqueuer` seam. The shape mirrors what
 *   `recordings.ts` enqueues — agnostic to pg-boss so tests can
 *   capture in memory.
 *
 * Audit actions emitted (added to apps/api/src/lib/audit-types.ts):
 *   - `invite.created`     (POST /tenants/:tenantId/invites)
 *   - `invite.revoked`     (DELETE /tenants/:tenantId/invites/:id)
 *   - `invite.accepted` + `user.created` (POST /invites/:token/accept)
 */

import { createHash, randomBytes } from 'node:crypto';
import {
  type AuthUserClaim,
  DEFAULT_REFRESH_TTL_SECONDS,
  type RefreshTokenStore,
  generateRefreshToken,
  hashPassword,
  signAccessToken,
} from '@aisecretary/auth';
import {
  type AuthResponse,
  type CreateInviteRequest,
  type Invite,
  type InviteLookupResponse,
  type InvitesListResponse,
  acceptInviteRequestSchema,
  authResponseSchema,
  createInviteRequestSchema,
  inviteLookupResponseSchema,
  invitesListResponseSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import {
  ConflictError,
  ForbiddenError,
  HttpError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../lib/http-error.js';
import { requireRole } from '../lib/role-check.js';
import {
  InviteEmailConflictError,
  type InviteRow,
  type InviteWithJoinsRow,
  type InvitesRepository,
} from './invites-repository.js';

/**
 * Dispatch seam mirroring `recordings.ts` `NotificationEnqueuer`.
 * Production wires a PgBoss-backed enqueuer; tests capture in memory.
 *
 * Kept narrowly scoped to the `tenant-invite` kind so other consumers
 * can't accidentally piggy-back on this seam — the recordings path has
 * its own enqueuer with its own kind union.
 */
export interface InviteNotificationEnqueuer {
  enqueue(payload: InviteNotificationJobPayload): Promise<string | null>;
}

export interface InviteNotificationJobPayload {
  tenantId: string;
  kind: 'tenant-invite';
  recipient: { channel: 'email'; email: string; name?: string };
  payload: { channel: 'email'; locale?: string; context: Record<string, unknown> };
  dedupKey?: string;
}

/** Default in-memory enqueuer — tests + dev. */
export class InMemoryInviteNotificationEnqueuer implements InviteNotificationEnqueuer {
  public readonly jobs: Array<{ id: string; payload: InviteNotificationJobPayload }> = [];
  private counter = 0;
  async enqueue(payload: InviteNotificationJobPayload): Promise<string | null> {
    this.counter += 1;
    const id = `invite-notif-${this.counter}`;
    this.jobs.push({ id, payload });
    return id;
  }
}

export interface InvitesRoutesOptions {
  repository: InvitesRepository;
  refreshStore: RefreshTokenStore;
  jwtSecret: string;
  region: 'us' | 'eu';
  /** Override TTLs (tests). */
  accessTtlSeconds?: number;
  refreshTtlSeconds?: number;
  /**
   * Notification enqueuer for the invite email. Optional — when unset,
   * the create route still succeeds but logs a warning. Production
   * wires the real enqueuer; tests typically inject the in-memory one.
   */
  notificationEnqueuer?: InviteNotificationEnqueuer;
  /**
   * Accept-URL base (e.g. `https://app.aisecretary.app`). Tests inject
   * a stable value; production reads from env. Default falls back to
   * the SaaS URL.
   */
  appBaseUrl?: string;
  /**
   * Story 1.5e — controls the refresh-cookie `secure` flag set on the
   * accept-invite response. Production must pass true.
   */
  isProduction?: boolean;
  /**
   * Story 13.3 — seat-ceiling check. Production wires a function that
   * reads `tenant_entitlements.seat_ceiling` + counts the current
   * non-revoked seats; tests stub. When the function returns
   * `{ allowed: false }`, the create route throws 403 with the
   * `extensions.upsell` hint that the locked-module upsell pattern
   * (Story 13.6) renders.
   *
   * Omit to skip the gate (default: allow every invite — preserves
   * the pre-Story-13.3 behavior for tests that don't care).
   */
  seatCeilingCheck?: (input: {
    tenantId: string;
  }) => Promise<{ allowed: true } | { allowed: false; ceiling: number; current: number }>;
}

const DEFAULT_TTL_DAYS = 7;
const DEFAULT_APP_BASE_URL = 'https://app.aisecretary.app';

/** sha256(plaintext) hex — matches the format stored in `tenant_invites.token_hash`. */
const hashToken = (plaintext: string): string =>
  createHash('sha256').update(plaintext).digest('hex');

/** Cryptographically random 32-byte token, base64url encoded. */
const generateInviteToken = (): string => randomBytes(32).toString('base64url');

const inviteToWire = (joined: InviteWithJoinsRow): Invite => ({
  id: joined.invite.id,
  email: joined.invite.email,
  role: joined.invite.role,
  invitedBy: { userId: joined.inviter.id, name: joined.inviter.name },
  expiresAt: joined.invite.expiresAt.toISOString(),
  acceptedAt: joined.invite.acceptedAt ? joined.invite.acceptedAt.toISOString() : null,
  revokedAt: joined.invite.revokedAt ? joined.invite.revokedAt.toISOString() : null,
  createdAt: joined.invite.createdAt.toISOString(),
});

const requireAuthedUser = (
  request: FastifyRequest,
): { userId: string; tenantId: string; role: string } => {
  if (!request.user) {
    throw new UnauthorizedError('Authentication required.');
  }
  return {
    userId: request.user.userId,
    tenantId: request.user.tenantId,
    role: request.user.role,
  };
};

/**
 * Tenant id from the URL must match the JWT-claim tenant id. Per the
 * project hard rule "never read tenantId from request body or query
 * params", this only authenticates the URL-supplied id against the
 * verified claim — it does NOT trust the URL itself.
 */
const assertTenantPathMatchesUser = (request: FastifyRequest, pathTenantId: string): void => {
  const claim = request.user;
  if (!claim) throw new UnauthorizedError('Authentication required.');
  if (claim.tenantId !== pathTenantId && claim.role !== 'super_admin') {
    throw new ForbiddenError('Tenant id mismatch.');
  }
};

const inviteLookupToWire = (joined: InviteWithJoinsRow): InviteLookupResponse => ({
  email: joined.invite.email,
  tenantName: joined.tenant.name,
  inviterName: joined.inviter.name,
  role: joined.invite.role,
  expiresAt: joined.invite.expiresAt.toISOString(),
});

/**
 * Compute the invite-state error (or null when the invite is
 * consumable).
 *   - revoked   → 410 Gone
 *   - accepted  → 409 Conflict
 *   - expired   → 410 Gone
 */
const checkInviteConsumable = (invite: InviteRow): HttpError | null => {
  if (invite.revokedAt !== null) {
    return new HttpError(410, 'Gone', 'This invite has been revoked.', {
      type: 'https://aisecretary.app/errors/invite-revoked',
    });
  }
  if (invite.acceptedAt !== null) {
    return new ConflictError('This invite has already been accepted.');
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    return new HttpError(410, 'Gone', 'This invite has expired.', {
      type: 'https://aisecretary.app/errors/invite-expired',
    });
  }
  return null;
};

export const invitesRoutes = (options: InvitesRoutesOptions): FastifyPluginAsync => {
  const appBaseUrl = options.appBaseUrl ?? DEFAULT_APP_BASE_URL;

  return async (fastify) => {
    // -------------------------------------------------------------------
    // Admin routes (authenticated; tenant-context resolved).
    // -------------------------------------------------------------------
    fastify.post(
      '/tenants/:tenantId/invites',
      {
        preHandler: [requireRole(['org_admin', 'super_admin'])],
        config: {
          auditTags: ['invite.created'],
        },
      },
      async (request, reply) => {
        const auth = requireAuthedUser(request);
        const { tenantId } = request.params as { tenantId: string };
        assertTenantPathMatchesUser(request, tenantId);

        const parsed = createInviteRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid invite payload.', {
            extensions: {
              errors: parsed.error.issues.map((i) => ({
                path: i.path.join('.'),
                message: i.message,
                code: i.code,
              })),
            },
          });
        }
        const input: CreateInviteRequest = parsed.data;

        // Story 13.3 — seat-ceiling enforcement. Skipped when the host
        // didn't wire a check function (back-compat for older tests).
        if (options.seatCeilingCheck) {
          const seatResult = await options.seatCeilingCheck({ tenantId });
          if (!seatResult.allowed) {
            throw new ForbiddenError(
              `Your plan's seat ceiling of ${seatResult.ceiling} has been reached.`,
              {
                extensions: {
                  code: 'seat-ceiling-reached',
                  ceiling: seatResult.ceiling,
                  current: seatResult.current,
                  upsell: {
                    minimumTier: seatResult.ceiling >= 25 ? 'business' : 'pro',
                    feature: 'seats',
                  },
                },
              },
            );
          }
        }

        const ttlDays = input.ttlDays ?? DEFAULT_TTL_DAYS;
        const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
        const plaintextToken = generateInviteToken();
        const tokenHash = hashToken(plaintextToken);

        let invite: InviteRow;
        try {
          invite = await options.repository.create({
            tenantId,
            invitedByUserId: auth.userId,
            email: input.email.toLowerCase(),
            role: input.role,
            tokenHash,
            expiresAt,
          });
        } catch (err) {
          if (err instanceof InviteEmailConflictError) {
            throw new ConflictError(err.message);
          }
          throw err;
        }

        // Look up tenant + inviter to populate the email body. The repo
        // already exposes a joined fetcher via `findByTokenHash`; we
        // can reuse it here for the same shape.
        const joined = await options.repository.findByTokenHash(tokenHash);
        const tenantName = joined?.tenant.name ?? 'your workspace';
        const inviterName = joined?.inviter.name ?? '';

        // Best-effort dispatch — failure to enqueue logs but doesn't
        // roll back the row (admin can revoke + recreate).
        if (options.notificationEnqueuer) {
          try {
            await options.notificationEnqueuer.enqueue({
              tenantId,
              kind: 'tenant-invite',
              recipient: { channel: 'email', email: invite.email },
              payload: {
                channel: 'email',
                context: {
                  tenantName,
                  inviterName,
                  role: invite.role,
                  acceptUrl: `${appBaseUrl}/accept-invite?token=${plaintextToken}`,
                  expiresAt: invite.expiresAt.toISOString(),
                },
              },
              dedupKey: `tenant-invite:${invite.id}`,
            });
          } catch (err) {
            request.log.warn({ err, inviteId: invite.id }, 'invites: notification dispatch failed');
          }
        } else {
          request.log.warn(
            { inviteId: invite.id },
            'invites: no notificationEnqueuer wired — email not dispatched',
          );
        }

        const wire: Invite = {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          invitedBy: { userId: auth.userId, name: inviterName },
          expiresAt: invite.expiresAt.toISOString(),
          acceptedAt: null,
          revokedAt: null,
          createdAt: invite.createdAt.toISOString(),
        };
        return reply.status(201).send(wire);
      },
    );

    fastify.get(
      '/tenants/:tenantId/invites',
      {
        preHandler: [requireRole(['org_admin', 'super_admin'])],
        config: { skipAudit: true },
      },
      async (request, reply) => {
        requireAuthedUser(request);
        const { tenantId } = request.params as { tenantId: string };
        assertTenantPathMatchesUser(request, tenantId);

        const result = await options.repository.list(tenantId);
        const body: InvitesListResponse = {
          items: result.items.map(inviteToWire),
          totalCount: result.totalCount,
        };
        return reply.status(200).send(invitesListResponseSchema.parse(body));
      },
    );

    fastify.delete(
      '/tenants/:tenantId/invites/:id',
      {
        preHandler: [requireRole(['org_admin', 'super_admin'])],
        config: {
          auditTags: ['invite.revoked'],
        },
      },
      async (request, reply) => {
        const auth = requireAuthedUser(request);
        const { tenantId, id } = request.params as { tenantId: string; id: string };
        assertTenantPathMatchesUser(request, tenantId);

        const existing = await options.repository.findById(id, tenantId);
        if (!existing) {
          throw new NotFoundError('Invite not found.');
        }
        if (existing.revokedAt !== null) {
          // Idempotent — return the row as-is rather than 409. The
          // audit row is suppressed because the row is already
          // revoked. We surface 200 + the existing state.
          const body: Pick<
            Invite,
            'id' | 'email' | 'role' | 'expiresAt' | 'acceptedAt' | 'revokedAt' | 'createdAt'
          > = {
            id: existing.id,
            email: existing.email,
            role: existing.role,
            expiresAt: existing.expiresAt.toISOString(),
            acceptedAt: existing.acceptedAt ? existing.acceptedAt.toISOString() : null,
            revokedAt: existing.revokedAt.toISOString(),
            createdAt: existing.createdAt.toISOString(),
          };
          return reply.status(200).send(body);
        }

        const updated = await options.repository.revoke(id, tenantId, auth.userId);
        if (!updated) {
          throw new NotFoundError('Invite not found.');
        }
        return reply.status(204).send();
      },
    );

    // -------------------------------------------------------------------
    // Public routes (unauthenticated; skip tenant-context).
    // -------------------------------------------------------------------
    fastify.get(
      '/invites/:token',
      {
        config: {
          skipTenantContext: true,
          skipAudit: true,
        },
      },
      async (request, reply) => {
        const { token } = request.params as { token: string };
        if (!token || token.length === 0) {
          throw new ValidationError('Missing invite token.');
        }
        const tokenHash = hashToken(token);
        const joined = await options.repository.findByTokenHash(tokenHash);
        if (!joined) {
          throw new NotFoundError('Invite not found.');
        }
        const stateErr = checkInviteConsumable(joined.invite);
        if (stateErr) throw stateErr;

        const body: InviteLookupResponse = inviteLookupToWire(joined);
        return reply.status(200).send(inviteLookupResponseSchema.parse(body));
      },
    );

    fastify.post(
      '/invites/:token/accept',
      {
        config: {
          skipTenantContext: true,
          skipAudit: true,
          // Manual audit emission — we need the tenantId from the
          // invite, not the (absent) request claim. The handler calls
          // `request.audit({...})` twice after the user is created.
          auditTags: [],
        },
      },
      async (request, reply) => {
        const { token } = request.params as { token: string };
        if (!token || token.length === 0) {
          throw new ValidationError('Missing invite token.');
        }
        const parsed = acceptInviteRequestSchema.safeParse({
          ...((request.body as Record<string, unknown>) ?? {}),
          token,
        });
        if (!parsed.success) {
          throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid accept payload.', {
            extensions: {
              errors: parsed.error.issues.map((i) => ({
                path: i.path.join('.'),
                message: i.message,
                code: i.code,
              })),
            },
          });
        }
        const tokenHash = hashToken(token);
        const joined = await options.repository.findByTokenHash(tokenHash);
        if (!joined) {
          throw new NotFoundError('Invite not found.');
        }
        const stateErr = checkInviteConsumable(joined.invite);
        if (stateErr) throw stateErr;

        const passwordHash = await hashPassword(parsed.data.password);
        const accepted = await options.repository.acceptInvite({
          inviteId: joined.invite.id,
          tenantId: joined.tenant.id,
          region: joined.tenant.region,
          email: joined.invite.email,
          passwordHash,
          name: parsed.data.name,
          role: joined.invite.role,
        });

        // Populate request.tenantId/region/user so the manual audit
        // calls below have the correct binding.
        request.tenantId = joined.tenant.id;
        request.region = joined.tenant.region;
        request.user = {
          tenantId: joined.tenant.id,
          userId: accepted.user.id,
          region: joined.tenant.region,
          role: accepted.user.role,
        };

        // Manual audit — two rows: invite consumed + user created.
        try {
          await request.audit({
            action: 'invite.accepted',
            resourceType: 'invite',
            resourceId: joined.invite.id,
            metadata: { email: joined.invite.email, role: joined.invite.role },
          });
          await request.audit({
            action: 'user.created',
            resourceType: 'user',
            resourceId: accepted.user.id,
            metadata: { via: 'invite', inviteId: joined.invite.id },
          });
        } catch (err) {
          request.log.warn(
            { err, inviteId: joined.invite.id, userId: accepted.user.id },
            'invites: audit emit failed on accept',
          );
        }

        // Mint a session pair — same shape as /auth/signup.
        const claim: AuthUserClaim = {
          userId: accepted.user.id,
          tenantId: accepted.user.tenantId,
          region: joined.tenant.region,
          role: accepted.user.role,
        };
        const access = await signAccessToken({
          user: claim,
          secret: options.jwtSecret,
          ...(options.accessTtlSeconds !== undefined
            ? { ttlSeconds: options.accessTtlSeconds }
            : {}),
        });
        const refreshToken = generateRefreshToken();
        await options.refreshStore.save({
          token: refreshToken,
          userId: accepted.user.id,
          tenantId: accepted.user.tenantId,
          expiresAt: new Date(
            Date.now() + (options.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL_SECONDS) * 1000,
          ),
        });

        const authResponse: AuthResponse = {
          accessToken: access.token,
          expiresIn: access.expiresIn,
          refreshToken,
          user: {
            id: accepted.user.id,
            email: accepted.user.email,
            name: accepted.user.name,
            role: accepted.user.role,
            tenantId: accepted.user.tenantId,
            region: joined.tenant.region,
            isMfaEnabled: accepted.user.isMfaEnabled,
          },
        };
        // Story 1.5e — set the same httpOnly cookie that /signup + /login
        // set, so accept-invite produces an immediately-cookie-authenticated
        // session for web clients. Mobile clients ignore the cookie and
        // use the body's refreshToken via expo-secure-store.
        reply.setCookie('aisecretary_refresh', refreshToken, {
          httpOnly: true,
          secure: options.isProduction === true,
          sameSite: 'lax',
          path: '/api/v1/auth',
          maxAge: options.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL_SECONDS,
        });
        return reply.status(201).send(authResponseSchema.parse(authResponse));
      },
    );
  };
};
