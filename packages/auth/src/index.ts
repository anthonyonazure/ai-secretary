/**
 * `@aisecretary/auth` — Argon2id password hashing, short-lived JWT
 * issuance/verification, and refresh-token rotation against a pluggable
 * store (Redis in production, in-memory in tests).
 *
 * Story 1.5a covers email/password + JWT. OAuth (1.5b), TOTP MFA
 * (1.5c), and email invites (1.5d) extend this package; SAML is a
 * reserved plugin slot per architecture.md § Authentication & Security.
 */

export const PACKAGE_NAME = '@aisecretary/auth';

export { ARGON2_PARAMS, hashPassword, verifyPassword } from './password.js';
export {
  DEFAULT_ACCESS_TTL_SECONDS,
  type SignAccessTokenInput,
  signAccessToken,
  verifyAccessToken,
} from './jwt.js';
export {
  DEFAULT_REFRESH_TTL_SECONDS,
  generateRefreshToken,
  type RefreshTokenRotateInput,
  type RefreshTokenSaveInput,
  type RefreshTokenStore,
} from './refresh-token.js';
export { InMemoryRefreshTokenStore } from './refresh-token-memory.js';
export { RedisRefreshTokenStore } from './refresh-token-redis.js';
export type { AccessTokenPayload, AuthUserClaim, RefreshTokenRecord } from './types.js';

// Story 1.5c — MFA primitives.
export {
  type EncryptedSecretPayload,
  decryptSecret,
  deserializeEncryptedSecret,
  encryptSecret,
  serializeEncryptedSecret,
  setDeterministicIvForTests,
} from './encryption.js';
export {
  assertMfaEncryptionKey,
  generateMfaEnrollment,
  type GenerateMfaEnrollmentInput,
  generateRecoveryCodes,
  hashRecoveryCode,
  type MfaEnrollment,
  newMfaChallengeId,
  type VerifyTotpInput,
  verifyTotpToken,
} from './mfa.js';
export {
  MFA_CHALLENGE_TTL_SECONDS,
  MFA_CHALLENGE_TYPE,
  type MfaChallengePayload,
  type SignMfaChallengeInput,
  signMfaChallenge,
  verifyMfaChallenge,
} from './mfa-challenge.js';
