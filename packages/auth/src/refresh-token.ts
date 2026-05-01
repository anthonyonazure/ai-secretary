/**
 * Refresh-token primitives.
 *
 * Refresh tokens are opaque random strings (256 bits, base64url-encoded)
 * stored server-side in a `RefreshTokenStore`. They have a long TTL
 * (default 30 days) and are rotated on every use — `rotate()` deletes
 * the old key and writes the new one atomically.
 *
 * The store interface is split out from any specific backend so unit
 * tests can use `InMemoryRefreshTokenStore` while production wires
 * `RedisRefreshTokenStore`.
 */

import { randomBytes } from 'node:crypto';
import type { RefreshTokenRecord } from './types.js';

export const DEFAULT_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/** Generate a 256-bit base64url refresh token. Always 43 chars. */
export const generateRefreshToken = (): string => randomBytes(32).toString('base64url');

export interface RefreshTokenSaveInput {
  token: string;
  userId: string;
  tenantId: string;
  expiresAt: Date;
}

export interface RefreshTokenRotateInput {
  token: string;
  expiresAt: Date;
}

/**
 * Server-side store for refresh tokens.
 *
 *   - `save`              — register a freshly issued token.
 *   - `lookup`            — read-only fetch (used by /refresh before rotate).
 *   - `rotate(old, new)`  — atomic delete-old / write-new. Returns the old
 *                           record if rotation succeeded, `null` if the
 *                           old token was unknown or already revoked.
 *   - `revoke(token)`     — delete a single token (logout).
 *   - `revokeAllForUser`  — invalidate every token for the user (e.g. on
 *                           password change).
 *
 * Implementations MUST honor per-token TTL — Redis SETEX is the
 * canonical mechanism. The in-memory implementation simulates this with
 * timestamp checks at lookup time.
 */
export interface RefreshTokenStore {
  save(record: RefreshTokenSaveInput): Promise<void>;
  lookup(token: string): Promise<RefreshTokenRecord | null>;
  rotate(oldToken: string, newRecord: RefreshTokenRotateInput): Promise<RefreshTokenRecord | null>;
  revoke(token: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
