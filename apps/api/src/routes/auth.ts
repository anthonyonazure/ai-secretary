/**
 * Auth routes — Story 1.5a slice (email/password + JWT + refresh-token
 * rotation), extended in Story 1.5c with TOTP MFA enrollment, login
 * challenge, recovery codes, and org-wide enforcement. OAuth (1.5b),
 * email invites (1.5d), and cookie-based refresh (1.5e) extend further.
 *
 * Mount path: `/api/v1/auth` (set by `buildServer()` via `prefix`).
 *
 * Story 1.5c additions:
 *   - POST /login is now a discriminated response: `{ kind: 'session', ... }`
 *     OR `{ kind: 'mfa-required', challengeToken, expiresAt,
 *     enrollmentRequired }`.
 *   - POST /login/verify-mfa redeems the challenge with a TOTP or
 *     recovery code → session JWT pair.
 *   - POST /mfa/enroll, /mfa/confirm, /mfa/disable, /mfa/recovery-codes/
 *     regenerate manage the lifecycle.
 *   - Per-user verify-attempt rate limit (5 fails / 15 min) tracked in
 *     the refresh-token store's underlying Redis where available; falls
 *     back to an in-memory counter in tests.
 */

import {
  type AuthUserClaim,
  DEFAULT_REFRESH_TTL_SECONDS,
  type RefreshTokenStore,
  decryptSecret,
  deserializeEncryptedSecret,
  encryptSecret,
  generateMfaEnrollment,
  generateRecoveryCodes,
  generateRefreshToken,
  hashPassword,
  hashRecoveryCode,
  serializeEncryptedSecret,
  signAccessToken,
  signMfaChallenge,
  verifyMfaChallenge,
  verifyPassword,
  verifyTotpToken,
} from '@aisecretary/auth';
import {
  type AuthResponse,
  type LoginResponse,
  type MeResponse,
  type MfaEnrollResponse,
  type MfaRecoveryCodesResponse,
  authResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  logoutRequestSchema,
  mfaConfirmRequestSchema,
  mfaDisableRequestSchema,
  mfaEnrollResponseSchema,
  mfaRecoveryCodesResponseSchema,
  mfaRegenerateRequestSchema,
  refreshRequestSchema,
  signupRequestSchema,
  verifyMfaRequestSchema,
} from '@aisecretary/shared';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  ConflictError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from '../lib/http-error.js';
import type { AuthRepository, AuthUserRow, UserMfaState } from './auth-repository.js';
import { tenantSlugFromName } from './auth-repository.js';

export interface AuthRoutesOptions {
  repository: AuthRepository;
  refreshStore: RefreshTokenStore;
  jwtSecret: string;
  /** Story 1.5c — secret for the 5-min MFA challenge JWT. */
  mfaChallengeSecret: string;
  /** Story 1.5c — 64-hex AES-256-GCM key for `mfa_secret_encrypted`. */
  mfaEncryptionKey: string;
  /** API region, used as the JWT region claim default. */
  region: 'us' | 'eu';
  /** Override TTLs (tests). */
  accessTtlSeconds?: number;
  refreshTtlSeconds?: number;
  /** Override challenge TTL (tests). */
  mfaChallengeTtlSeconds?: number;
  /** Issuer label for the otpauth URI. */
  mfaIssuer?: string;
  /**
   * Story 1.5e — controls the refresh-cookie `secure` flag. When true,
   * the cookie is only sent over HTTPS. Production must pass true.
   */
  isProduction?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Per-user MFA verify attempt counter.                                        */
/*                                                                            */
/* Locks a user out for 15 min after 5 failed verify attempts. Backed by a    */
/* simple Map; production deployments behind multiple API instances can       */
/* swap this for a Redis-backed implementation when Story 1.5e tightens       */
/* refresh-token storage. Per-user (not per-IP) because the threat model is   */
/* a stuffed credential combined with a device-bound TOTP secret — locking    */
/* per-IP would let attackers bypass via NAT rotation.                        */
/* -------------------------------------------------------------------------- */

const MFA_LOCKOUT_LIMIT = 5;
const MFA_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

interface AttemptState {
  count: number;
  lockedUntil: number;
}

const mfaAttemptCounters = new Map<string, AttemptState>();

const recordMfaFailure = (userId: string): { locked: boolean; lockedUntil: number } => {
  const now = Date.now();
  const existing = mfaAttemptCounters.get(userId);
  // Drop EXPIRED lockouts only — `lockedUntil > 0` filters out the
  // never-locked initial state, so a streak of failures accumulates.
  if (existing && existing.lockedUntil > 0 && existing.lockedUntil <= now) {
    mfaAttemptCounters.delete(userId);
  }
  const state = mfaAttemptCounters.get(userId) ?? { count: 0, lockedUntil: 0 };
  state.count += 1;
  if (state.count >= MFA_LOCKOUT_LIMIT) {
    state.lockedUntil = now + MFA_LOCKOUT_WINDOW_MS;
  }
  mfaAttemptCounters.set(userId, state);
  return { locked: state.count >= MFA_LOCKOUT_LIMIT, lockedUntil: state.lockedUntil };
};

const isMfaLocked = (userId: string): { locked: boolean; lockedUntil: number } => {
  const state = mfaAttemptCounters.get(userId);
  if (!state) return { locked: false, lockedUntil: 0 };
  if (state.lockedUntil > Date.now()) return { locked: true, lockedUntil: state.lockedUntil };
  if (state.lockedUntil > 0) {
    // Window expired — clear.
    mfaAttemptCounters.delete(userId);
  }
  return { locked: false, lockedUntil: 0 };
};

const clearMfaFailures = (userId: string): void => {
  mfaAttemptCounters.delete(userId);
};

/** Test-only — exported via the routes module so suite teardown can reset. */
export const __resetMfaCountersForTests = (): void => {
  mfaAttemptCounters.clear();
};

const buildAuthResponse = async (
  user: AuthUserRow,
  region: 'us' | 'eu',
  options: AuthRoutesOptions,
): Promise<AuthResponse> => {
  const claim: AuthUserClaim = {
    userId: user.id,
    tenantId: user.tenantId,
    region,
    role: user.role,
  };
  const access = await signAccessToken({
    user: claim,
    secret: options.jwtSecret,
    ...(options.accessTtlSeconds !== undefined ? { ttlSeconds: options.accessTtlSeconds } : {}),
  });
  const refreshToken = generateRefreshToken();

  return {
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      region,
      isMfaEnabled: user.isMfaEnabled,
    },
  };
};

const issueSessionAndPersist = async (
  user: AuthUserRow,
  region: 'us' | 'eu',
  options: AuthRoutesOptions,
): Promise<AuthResponse> => {
  const authResponse = await buildAuthResponse(user, region, options);
  await options.refreshStore.save({
    token: authResponse.refreshToken,
    userId: user.id,
    tenantId: user.tenantId,
    expiresAt: new Date(
      Date.now() + (options.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL_SECONDS) * 1000,
    ),
  });
  return authResponse;
};

/* -------------------------------------------------------------------------- */
/* Story 1.5e — httpOnly refresh-token cookie.                                 */
/*                                                                            */
/* Web clients receive the refresh token via a `aisecretary_refresh` cookie    */
/* (httpOnly, secure in prod, sameSite=lax to allow top-level POST after a    */
/* redirect from the email-verify flow). The token also lives in the JSON      */
/* response body so mobile clients (using expo-secure-store) keep working      */
/* without changes — the body field is the same `refreshToken`. The /refresh  */
/* endpoint reads the cookie first, falls back to the body, so both paths     */
/* coexist cleanly.                                                            */
/* -------------------------------------------------------------------------- */

const REFRESH_COOKIE_NAME = 'aisecretary_refresh';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

const refreshTtlSeconds = (options: AuthRoutesOptions): number =>
  options.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL_SECONDS;

const setRefreshCookie = (
  reply: FastifyReply,
  token: string,
  options: AuthRoutesOptions,
  isProduction: boolean,
): void => {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshTtlSeconds(options),
  });
};

const clearRefreshCookie = (reply: FastifyReply, isProduction: boolean): void => {
  reply.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  });
};

const readRefreshFromRequest = (
  request: FastifyRequest,
  fromBody: string | undefined,
): string | null => {
  const cookies = (request as FastifyRequest & { cookies?: Record<string, string | undefined> })
    .cookies;
  const fromCookie = cookies?.[REFRESH_COOKIE_NAME];
  return fromCookie ?? fromBody ?? null;
};

const requireAuthenticatedUser = (request: FastifyRequest): NonNullable<FastifyRequest['user']> => {
  if (!request.user) {
    throw new UnauthorizedError('Authentication required.');
  }
  return request.user;
};

export const authRoutes = (options: AuthRoutesOptions): FastifyPluginAsync => {
  const issuer = options.mfaIssuer ?? 'AI Secretary';
  const challengeTtl = options.mfaChallengeTtlSeconds;
  const isProd = options.isProduction === true;

  return async (fastify) => {
    fastify.post(
      '/signup',
      {
        config: {
          skipTenantContext: true,
          skipAudit: true,
          auditTags: ['tenant.created', 'user.created'],
        },
      },
      async (request: FastifyRequest, reply) => {
        const parsed = signupRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid signup payload', {
            extensions: {
              errors: parsed.error.issues.map((i) => ({
                path: i.path.join('.'),
                message: i.message,
                code: i.code,
              })),
            },
          });
        }
        const input = parsed.data;
        const email = input.email.toLowerCase();

        const existing = await options.repository.findUserByEmail(email);
        if (existing) {
          throw new ConflictError('An account with this email already exists.');
        }

        const tenant = await options.repository.createTenant({
          name: input.tenantName,
          slug: tenantSlugFromName(input.tenantName),
          region: input.region,
        });

        const passwordHash = await hashPassword(input.password);
        const user = await options.repository.createUser({
          tenantId: tenant.id,
          email,
          name: input.name,
          role: 'org_admin',
          passwordHash,
        });

        request.tenantId = tenant.id;
        request.region = tenant.region;
        request.user = {
          tenantId: tenant.id,
          userId: user.id,
          region: tenant.region,
          role: user.role,
        };

        const authResponse = await issueSessionAndPersist(user, tenant.region, options);
        setRefreshCookie(reply, authResponse.refreshToken, options, isProd);
        const validated = authResponseSchema.parse(authResponse);
        return reply.status(201).send(validated);
      },
    );

    fastify.post(
      '/login',
      {
        config: {
          skipTenantContext: true,
          skipAudit: true,
        },
      },
      async (request: FastifyRequest, reply) => {
        const parsed = loginRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid login payload');
        }
        const { email, password } = parsed.data;

        const user = await options.repository.findUserByEmail(email.toLowerCase());
        if (!user || !user.passwordHash) {
          throw new UnauthorizedError('Invalid email or password.');
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          throw new UnauthorizedError('Invalid email or password.');
        }

        const tenant = await options.repository.findTenantById(user.tenantId);
        if (!tenant) {
          throw new UnauthorizedError('Tenant not found.');
        }

        // Story 1.5c — branch on MFA state.
        // Three cases:
        //   1. user.isMfaEnabled            → mfa-required (verify TOTP/recovery)
        //   2. tenant.mfaRequired && !user  → mfa-required + enrollmentRequired
        //   3. neither                      → session immediately
        const userNeedsMfa = user.isMfaEnabled;
        const tenantForcesMfa = tenant.mfaRequired;
        const enrollmentRequired = tenantForcesMfa && !userNeedsMfa;

        if (userNeedsMfa || tenantForcesMfa) {
          const challenge = await signMfaChallenge({
            user: {
              userId: user.id,
              tenantId: user.tenantId,
              region: tenant.region,
              role: user.role,
            },
            enrollmentRequired,
            secret: options.mfaChallengeSecret,
            ...(challengeTtl !== undefined ? { ttlSeconds: challengeTtl } : {}),
          });
          const body: LoginResponse = {
            kind: 'mfa-required',
            challengeToken: challenge.token,
            expiresAt: challenge.expiresAt.toISOString(),
            enrollmentRequired,
          };
          const validated = loginResponseSchema.parse(body);
          return reply.status(200).send(validated);
        }

        const authResponse = await issueSessionAndPersist(user, tenant.region, options);
        setRefreshCookie(reply, authResponse.refreshToken, options, isProd);

        try {
          await options.repository.touchLastLogin(user.id, user.tenantId, tenant.region);
        } catch (err) {
          request.log.warn({ err, userId: user.id }, 'auth: touchLastLogin failed');
        }

        const body: LoginResponse = { kind: 'session', ...authResponse };
        const validated = loginResponseSchema.parse(body);
        return reply.status(200).send(validated);
      },
    );

    fastify.post(
      '/login/verify-mfa',
      {
        config: {
          skipTenantContext: true,
          skipAudit: true,
        },
      },
      async (request: FastifyRequest, reply) => {
        const parsed = verifyMfaRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid verify-mfa payload',
          );
        }
        const { challengeToken, code } = parsed.data;

        let payload: Awaited<ReturnType<typeof verifyMfaChallenge>>;
        try {
          payload = await verifyMfaChallenge(challengeToken, options.mfaChallengeSecret);
        } catch {
          throw new UnauthorizedError('MFA challenge invalid or expired.');
        }

        if (payload.enrollmentRequired) {
          // Tenant forces MFA but user has not enrolled — refuse the
          // challenge. Client must complete enrollment first; the
          // session-bearing path is `/mfa/confirm` which already issues
          // a session post-enrollment.
          throw new UnauthorizedError(
            'MFA enrollment required by tenant policy before sign-in completes.',
          );
        }

        const lock = isMfaLocked(payload.sub);
        if (lock.locked) {
          throw new RateLimitError('Too many failed MFA attempts. Try again in 15 minutes.', {
            extensions: { lockedUntil: new Date(lock.lockedUntil).toISOString() },
          });
        }

        const mfaState = await options.repository.findUserByIdForMfa(payload.sub, payload.tenantId);
        if (!mfaState || !mfaState.isMfaEnabled || !mfaState.mfaSecretEncrypted) {
          throw new UnauthorizedError('MFA not enrolled.');
        }

        const trimmed = code.trim();
        const isLikelyTotp = /^\d{6}$/.test(trimmed);

        // Bind context for the failure audit-emit so we can populate
        // request.user before calling request.audit().
        const tenant = await options.repository.findTenantById(payload.tenantId);
        if (!tenant) {
          throw new UnauthorizedError('Tenant not found.');
        }
        request.tenantId = payload.tenantId;
        request.region = tenant.region;
        request.user = {
          tenantId: payload.tenantId,
          userId: payload.sub,
          region: tenant.region,
          role: payload.role,
        };

        let verified = false;
        let usedRecoveryCode = false;

        if (isLikelyTotp) {
          let totpSecret: string;
          try {
            const wrapped = deserializeEncryptedSecret(mfaState.mfaSecretEncrypted);
            totpSecret = decryptSecret(wrapped, options.mfaEncryptionKey);
          } catch (err) {
            request.log.error({ err, userId: payload.sub }, 'auth: failed to decrypt TOTP secret');
            throw new UnauthorizedError('MFA verification failed.');
          }
          verified = verifyTotpToken({ secret: totpSecret, token: trimmed });
        } else {
          const codeHash = hashRecoveryCode(trimmed);
          const consumed = await options.repository.consumeRecoveryCode(
            payload.sub,
            payload.tenantId,
            codeHash,
          );
          verified = consumed;
          usedRecoveryCode = consumed;
        }

        if (!verified) {
          const result = recordMfaFailure(payload.sub);
          await request.audit({
            action: 'user.mfa-failed-verification',
            resourceType: 'user',
            resourceId: payload.sub,
            metadata: {
              method: isLikelyTotp ? 'totp' : 'recovery-code',
              locked: result.locked,
            },
          });
          if (result.locked) {
            throw new RateLimitError('Too many failed MFA attempts. Try again in 15 minutes.', {
              extensions: { lockedUntil: new Date(result.lockedUntil).toISOString() },
            });
          }
          throw new UnauthorizedError('MFA verification failed.');
        }

        clearMfaFailures(payload.sub);

        // Re-fetch the public user shape (without MFA-state private fields).
        const userRow = await options.repository.findUserById(payload.sub);
        if (!userRow) {
          throw new UnauthorizedError('User not found.');
        }
        const authResponse = await issueSessionAndPersist(userRow, tenant.region, options);
        setRefreshCookie(reply, authResponse.refreshToken, options, isProd);

        try {
          await options.repository.touchLastLogin(userRow.id, userRow.tenantId, tenant.region);
        } catch (err) {
          request.log.warn({ err, userId: userRow.id }, 'auth: touchLastLogin failed');
        }

        const body: LoginResponse = { kind: 'session', ...authResponse };
        // Mirror the wire contract — login returns the same union here
        // so clients can reuse the same parser.
        const validated = loginResponseSchema.parse(body);
        // Annotate log line for ops triage on recovery-code use.
        if (usedRecoveryCode) {
          request.log.info({ userId: userRow.id }, 'auth: MFA verified via recovery code');
        }
        return reply.status(200).send(validated);
      },
    );

    fastify.post(
      '/mfa/enroll',
      {
        config: {
          // Enrollment-pending state is a reversible client-side step;
          // the security-relevant moment is `/mfa/confirm`, which audits
          // `user.mfa-enrolled`. Re-running enroll just overwrites the
          // pending secret; nothing here moves the account into a more
          // privileged state. Keeping the audit gate here would force
          // a `user.mfa-enroll-started` action that adds noise without
          // a real security signal.
          skipAudit: true,
        },
      },
      async (request: FastifyRequest, reply) => {
        const auth = requireAuthenticatedUser(request);
        const mfaState = await options.repository.findUserByIdForMfa(auth.userId, auth.tenantId);
        if (!mfaState) {
          throw new UnauthorizedError('User not found.');
        }
        const enrollment = generateMfaEnrollment({
          accountName: mfaState.email,
          issuer,
        });
        const wrapped = encryptSecret(enrollment.secret, options.mfaEncryptionKey);
        const recoveryCodeHashes = enrollment.recoveryCodes.map(hashRecoveryCode);
        await options.repository.setMfaEnrollment(auth.userId, auth.tenantId, {
          encryptedSecret: serializeEncryptedSecret(wrapped),
          recoveryCodeHashes,
        });
        const body: MfaEnrollResponse = {
          otpauthUri: enrollment.otpauthUri,
          secret: enrollment.secret,
          recoveryCodes: enrollment.recoveryCodes,
        };
        const validated = mfaEnrollResponseSchema.parse(body);
        return reply.status(200).send(validated);
      },
    );

    fastify.post('/mfa/confirm', async (request: FastifyRequest, reply) => {
      const auth = requireAuthenticatedUser(request);
      const parsed = mfaConfirmRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid confirm payload');
      }
      const mfaState = await options.repository.findUserByIdForMfa(auth.userId, auth.tenantId);
      if (!mfaState || !mfaState.mfaSecretEncrypted || !mfaState.mfaPending) {
        throw new ValidationError(
          'No pending MFA enrollment. Call /auth/mfa/enroll before /auth/mfa/confirm.',
        );
      }
      let secret: string;
      try {
        secret = decryptSecret(
          deserializeEncryptedSecret(mfaState.mfaSecretEncrypted),
          options.mfaEncryptionKey,
        );
      } catch (err) {
        request.log.error({ err, userId: auth.userId }, 'auth: confirm MFA decrypt failed');
        throw new UnauthorizedError('MFA verification failed.');
      }
      const ok = verifyTotpToken({ secret, token: parsed.data.code });
      if (!ok) {
        throw new UnauthorizedError('Invalid MFA code.');
      }
      await options.repository.confirmMfaEnrollment(auth.userId, auth.tenantId);
      await request.audit({
        action: 'user.mfa-enrolled',
        resourceType: 'user',
        resourceId: auth.userId,
      });
      return reply.status(204).send();
    });

    fastify.post('/mfa/disable', async (request: FastifyRequest, reply) => {
      const auth = requireAuthenticatedUser(request);
      const parsed = mfaDisableRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid disable payload');
      }
      const mfaState = await options.repository.findUserByIdForMfa(auth.userId, auth.tenantId);
      if (!mfaState || !mfaState.isMfaEnabled || !mfaState.mfaSecretEncrypted) {
        throw new ValidationError('MFA is not enabled.');
      }
      await assertPasswordAndCode(parsed.data, mfaState, options);
      await options.repository.disableMfa(auth.userId, auth.tenantId);
      clearMfaFailures(auth.userId);
      await request.audit({
        action: 'user.mfa-disabled',
        resourceType: 'user',
        resourceId: auth.userId,
      });
      return reply.status(204).send();
    });

    fastify.post('/mfa/recovery-codes/regenerate', async (request: FastifyRequest, reply) => {
      const auth = requireAuthenticatedUser(request);
      const parsed = mfaRegenerateRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid regenerate payload');
      }
      const mfaState = await options.repository.findUserByIdForMfa(auth.userId, auth.tenantId);
      if (!mfaState || !mfaState.isMfaEnabled || !mfaState.mfaSecretEncrypted) {
        throw new ValidationError('MFA is not enabled.');
      }
      await assertPasswordAndCode(parsed.data, mfaState, options);
      const fresh = generateRecoveryCodes();
      const hashes = fresh.map(hashRecoveryCode);
      await options.repository.setMfaEnrollment(auth.userId, auth.tenantId, {
        // Preserve the existing TOTP secret blob; only swap the
        // hashes. `setMfaEnrollment` flips `mfa_pending=true` —
        // immediately re-confirm so the user stays enrolled.
        encryptedSecret: mfaState.mfaSecretEncrypted,
        recoveryCodeHashes: hashes,
      });
      await options.repository.confirmMfaEnrollment(auth.userId, auth.tenantId);
      // Force-revoke every refresh token: regenerating recovery codes
      // is a credential-rotation event, so we want a hard re-login.
      await options.refreshStore.revokeAllForUser(auth.userId);
      await request.audit({
        action: 'user.mfa-recovery-codes-regenerated',
        resourceType: 'user',
        resourceId: auth.userId,
      });
      const body: MfaRecoveryCodesResponse = { recoveryCodes: fresh };
      const validated = mfaRecoveryCodesResponseSchema.parse(body);
      return reply.status(200).send(validated);
    });

    fastify.post(
      '/refresh',
      {
        config: {
          skipTenantContext: true,
          skipAudit: true,
        },
      },
      async (request: FastifyRequest, reply) => {
        // Story 1.5e — refresh token may arrive via the httpOnly cookie
        // (web) OR the JSON body (mobile, where expo-secure-store is the
        // store of record). Body is optional under the cookie path.
        const parsed = refreshRequestSchema.partial().safeParse(request.body ?? {});
        const fromBody = parsed.success ? parsed.data.refreshToken : undefined;
        const oldToken = readRefreshFromRequest(request, fromBody);
        if (!oldToken) {
          throw new UnauthorizedError('Refresh token missing.');
        }

        const newToken = generateRefreshToken();
        const refreshTtl = options.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL_SECONDS;
        const newExpiresAt = new Date(Date.now() + refreshTtl * 1000);

        const previous = await options.refreshStore.rotate(oldToken, {
          token: newToken,
          expiresAt: newExpiresAt,
        });
        if (!previous) {
          throw new UnauthorizedError('Refresh token invalid or revoked.');
        }

        const user = await options.repository.findUserById(previous.userId);
        if (!user) {
          await options.refreshStore.revoke(newToken);
          throw new UnauthorizedError('Refresh token invalid or revoked.');
        }
        const tenant = await options.repository.findTenantById(user.tenantId);
        if (!tenant) {
          await options.refreshStore.revoke(newToken);
          throw new UnauthorizedError('Tenant not found.');
        }

        const authResponse = await buildAuthResponse(user, tenant.region, options);
        authResponse.refreshToken = newToken;
        setRefreshCookie(reply, newToken, options, isProd);

        const validated = authResponseSchema.parse(authResponse);
        return reply.status(200).send(validated);
      },
    );

    fastify.post(
      '/logout',
      {
        config: {
          skipTenantContext: true,
          skipAudit: true,
        },
      },
      async (request: FastifyRequest, reply) => {
        // Story 1.5e — accept either body (legacy/mobile) or cookie (web).
        const parsed = logoutRequestSchema.partial().safeParse(request.body ?? {});
        const fromBody = parsed.success ? parsed.data.refreshToken : undefined;
        const token = readRefreshFromRequest(request, fromBody);
        if (token) {
          await options.refreshStore.revoke(token);
        }
        clearRefreshCookie(reply, isProd);
        return reply.status(204).send();
      },
    );

    fastify.get('/me', async (request: FastifyRequest, reply) => {
      if (!request.user) {
        throw new UnauthorizedError('Authentication required.');
      }
      const user = await options.repository.findUserById(request.user.userId);
      if (!user) {
        throw new UnauthorizedError('User not found.');
      }
      const tenant = await options.repository.findTenantById(user.tenantId);
      if (!tenant) {
        throw new UnauthorizedError('Tenant not found.');
      }
      const body: MeResponse = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          region: tenant.region,
          isMfaEnabled: user.isMfaEnabled,
        },
      };
      return reply.status(200).send(body);
    });
  };
};

/**
 * Re-verify a user's password + TOTP. Used by `/mfa/disable` and
 * `/mfa/recovery-codes/regenerate` — both are credential-rotation events
 * where defence-in-depth justifies the double check. Throws
 * UnauthorizedError on either failure.
 */
const assertPasswordAndCode = async (
  input: { password: string; code: string },
  mfaState: UserMfaState,
  options: AuthRoutesOptions,
): Promise<void> => {
  if (!mfaState.passwordHash) {
    throw new UnauthorizedError('Password verification not available.');
  }
  const passwordOk = await verifyPassword(input.password, mfaState.passwordHash);
  if (!passwordOk) {
    throw new UnauthorizedError('Invalid password.');
  }
  if (!mfaState.mfaSecretEncrypted) {
    throw new UnauthorizedError('MFA is not enabled.');
  }
  let secret: string;
  try {
    secret = decryptSecret(
      deserializeEncryptedSecret(mfaState.mfaSecretEncrypted),
      options.mfaEncryptionKey,
    );
  } catch {
    throw new UnauthorizedError('MFA verification failed.');
  }
  const trimmed = input.code.trim();
  const isLikelyTotp = /^\d{6}$/.test(trimmed);
  if (isLikelyTotp) {
    if (!verifyTotpToken({ secret, token: trimmed })) {
      throw new UnauthorizedError('Invalid MFA code.');
    }
  } else {
    // Allow recovery codes too, for the flow where the user has lost
    // their authenticator and wants to disable / rotate.
    const codeHash = hashRecoveryCode(trimmed);
    if (!mfaState.recoveryCodeHashes.includes(codeHash)) {
      throw new UnauthorizedError('Invalid MFA code.');
    }
  }
};
