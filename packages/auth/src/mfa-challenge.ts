/**
 * MFA challenge JWT — short-lived (5min) bearer that proves the user
 * already cleared the password leg of `/login`. Carrying this over an
 * HTTP boundary (rather than a server-side session id) keeps the API
 * stateless; the `verify-mfa` route only needs the env secret to verify.
 *
 * Signed with `JWT_MFA_CHALLENGE_SECRET` — distinct from the session
 * secret so a leaked challenge token can never be confused with a
 * session token by `verifyAccessToken`.
 */

import type { Region, UserRole } from '@aisecretary/shared';
import { SignJWT, jwtVerify } from 'jose';
import { newMfaChallengeId } from './mfa.js';

export const MFA_CHALLENGE_TTL_SECONDS = 5 * 60; // 5 minutes
export const MFA_CHALLENGE_TYPE = 'mfa-challenge';

export interface MfaChallengePayload {
  /** User id (sub claim). */
  sub: string;
  tenantId: string;
  region: Region;
  role: UserRole;
  /** Discriminator — protects against token-type confusion. */
  type: 'mfa-challenge';
  /**
   * Whether the tenant is forcing enrollment (`tenant.mfa_required` AND
   * the user hasn't enrolled yet). The `verify-mfa` endpoint refuses
   * codes when this is set — the client must take the user through
   * enrollment before issuing a session.
   */
  enrollmentRequired: boolean;
  iat: number;
  exp: number;
  jti: string;
}

const encodeSecret = (secret: string): Uint8Array => new TextEncoder().encode(secret);

export interface SignMfaChallengeInput {
  user: {
    userId: string;
    tenantId: string;
    region: Region;
    role: UserRole;
  };
  enrollmentRequired: boolean;
  secret: string;
  /** Override TTL (tests). */
  ttlSeconds?: number;
  now?: Date;
}

export const signMfaChallenge = async (
  input: SignMfaChallengeInput,
): Promise<{ token: string; expiresAt: Date; jti: string }> => {
  const ttl = input.ttlSeconds ?? MFA_CHALLENGE_TTL_SECONDS;
  const issuedAt = Math.floor((input.now?.getTime() ?? Date.now()) / 1000);
  const expiresAt = issuedAt + ttl;
  const jti = newMfaChallengeId();

  const token = await new SignJWT({
    tenantId: input.user.tenantId,
    region: input.user.region,
    role: input.user.role,
    type: MFA_CHALLENGE_TYPE,
    enrollmentRequired: input.enrollmentRequired,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(input.user.userId)
    .setJti(jti)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(encodeSecret(input.secret));

  return { token, expiresAt: new Date(expiresAt * 1000), jti };
};

const isRegion = (value: unknown): value is Region => value === 'us' || value === 'eu';

const isUserRole = (value: unknown): value is UserRole =>
  value === 'super_admin' ||
  value === 'org_admin' ||
  value === 'org_member' ||
  value === 'org_viewer';

export const verifyMfaChallenge = async (
  token: string,
  secret: string,
): Promise<MfaChallengePayload> => {
  const { payload } = await jwtVerify(token, encodeSecret(secret), {
    algorithms: ['HS256'],
  });

  const sub = payload.sub;
  const tenantId = payload.tenantId;
  const region = payload.region;
  const role = payload.role;
  const type = payload.type;
  const enrollmentRequired = payload.enrollmentRequired;
  const iat = payload.iat;
  const exp = payload.exp;
  const jti = payload.jti;

  if (typeof sub !== 'string' || sub.length === 0) {
    throw new Error('mfa-challenge: missing sub');
  }
  if (typeof tenantId !== 'string') {
    throw new Error('mfa-challenge: missing tenantId');
  }
  if (!isRegion(region)) {
    throw new Error('mfa-challenge: invalid region');
  }
  if (!isUserRole(role)) {
    throw new Error('mfa-challenge: invalid role');
  }
  if (type !== MFA_CHALLENGE_TYPE) {
    throw new Error('mfa-challenge: wrong token type');
  }
  if (typeof enrollmentRequired !== 'boolean') {
    throw new Error('mfa-challenge: missing enrollmentRequired');
  }
  if (typeof iat !== 'number' || typeof exp !== 'number') {
    throw new Error('mfa-challenge: missing timestamps');
  }
  if (typeof jti !== 'string' || jti.length === 0) {
    throw new Error('mfa-challenge: missing jti');
  }

  return { sub, tenantId, region, role, type, enrollmentRequired, iat, exp, jti };
};
