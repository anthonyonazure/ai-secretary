/**
 * Short-lived JWT issuance + verification.
 *
 * Spec: 15-minute access tokens, HS256, secret from env (`JWT_SECRET`).
 * Refresh tokens live in Redis (see `refresh-token-redis.ts`) and are
 * rotated on use; this module only handles the access leg.
 *
 * Why `jose` over `jsonwebtoken`:
 *   - Modern ESM-native API (no `require`).
 *   - Built-in Web Crypto verification — no `Buffer` dependency.
 *   - Maintained, used by the Fastify ecosystem (`@fastify/jwt` v9+).
 *   - Better TypeScript types out of the box.
 */

import type { Region, UserRole } from '@aisecretary/shared';
import { SignJWT, jwtVerify } from 'jose';
import type { AccessTokenPayload, AuthUserClaim } from './types.js';

export const DEFAULT_ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes

export interface SignAccessTokenInput {
  user: AuthUserClaim;
  secret: string;
  /** Override default 15min ttl. */
  ttlSeconds?: number;
  /** Override `iat` for tests. */
  now?: Date;
}

const encodeSecret = (secret: string): Uint8Array => new TextEncoder().encode(secret);

/**
 * Mint a signed access token. Returns the JWS compact string and the
 * effective `expiresIn` (seconds) so callers can echo it on the
 * `authResponseSchema.expiresIn` field without re-deriving.
 */
export const signAccessToken = async (
  input: SignAccessTokenInput,
): Promise<{ token: string; expiresIn: number }> => {
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_ACCESS_TTL_SECONDS;
  const issuedAt = Math.floor((input.now?.getTime() ?? Date.now()) / 1000);
  const expiresAt = issuedAt + ttlSeconds;

  const token = await new SignJWT({
    tenantId: input.user.tenantId,
    region: input.user.region,
    role: input.user.role,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(input.user.userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(encodeSecret(input.secret));

  return { token, expiresIn: ttlSeconds };
};

const isRegion = (value: unknown): value is Region => value === 'us' || value === 'eu';

const isUserRole = (value: unknown): value is UserRole =>
  value === 'super_admin' ||
  value === 'org_admin' ||
  value === 'org_member' ||
  value === 'org_viewer';

/**
 * Verify a JWS access token. Throws when the signature is invalid, the
 * token is expired, or the payload doesn't carry the expected claims.
 *
 * The Fastify `jwt` plugin in `apps/api` swallows the throw and leaves
 * `request.user = null` so individual route handlers decide how to
 * react (401 vs. continue as unauthenticated).
 */
export const verifyAccessToken = async (
  token: string,
  secret: string,
): Promise<AccessTokenPayload> => {
  const { payload } = await jwtVerify(token, encodeSecret(secret), {
    algorithms: ['HS256'],
  });

  const sub = payload.sub;
  const tenantId = payload.tenantId;
  const region = payload.region;
  const role = payload.role;
  const iat = payload.iat;
  const exp = payload.exp;

  if (typeof sub !== 'string' || sub.length === 0) {
    throw new Error('access-token: missing sub');
  }
  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    throw new Error('access-token: missing tenantId');
  }
  if (!isRegion(region)) {
    throw new Error('access-token: invalid region');
  }
  if (!isUserRole(role)) {
    throw new Error('access-token: invalid role');
  }
  if (typeof iat !== 'number') {
    throw new Error('access-token: missing iat');
  }
  if (typeof exp !== 'number') {
    throw new Error('access-token: missing exp');
  }

  return { sub, tenantId, region, role, iat, exp };
};
