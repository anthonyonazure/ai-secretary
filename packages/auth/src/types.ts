/**
 * Shared types for `@aisecretary/auth`.
 *
 * `AccessTokenPayload` is the verified-claim shape for JWTs minted by
 * `signAccessToken`. The Fastify `jwt` plugin in `apps/api` uses these
 * fields to populate `request.user` after verification.
 *
 * `RefreshTokenRecord` is the persisted shape of a refresh token in the
 * `RefreshTokenStore`. The token itself (a 256-bit base64url string) is
 * the lookup key; the record carries the binding metadata.
 *
 * `AuthUserClaim` is the slimmed-down user object that the issuer hands
 * to `signAccessToken` — the JWT carries only the audit-relevant slice,
 * not the full row.
 */

import type { Region, UserRole } from '@aisecretary/shared';

export interface AccessTokenPayload {
  /** User id (sub claim). */
  sub: string;
  tenantId: string;
  region: Region;
  role: UserRole;
  /** Issued-at (seconds since epoch). */
  iat: number;
  /** Expiry (seconds since epoch). */
  exp: number;
}

export interface AuthUserClaim {
  userId: string;
  tenantId: string;
  region: Region;
  role: UserRole;
}

export interface RefreshTokenRecord {
  token: string;
  userId: string;
  tenantId: string;
  expiresAt: Date;
}
