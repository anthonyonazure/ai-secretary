/**
 * TOTP MFA primitives — Story 1.5c.
 *
 * Uses `otplib`'s `authenticator` (RFC 6238) with a ±1-step verification
 * window to absorb 30s of clock skew on either side of the current
 * 30-second TOTP step. Recovery codes are 4-4-4 hex (12 hex chars,
 * 48 bits of entropy) — formatted with dashes for readability and
 * stored only as SHA-256 hashes (one-way, single-use).
 *
 * Encryption of the per-user TOTP secret happens in `encryption.ts`
 * (AES-256-GCM keyed by `MFA_SECRET_ENCRYPTION_KEY`); this module only
 * deals with TOTP math + recovery codes.
 *
 * The `assertMfaEncryptionKey` helper is called at API boot so the
 * server fails fast if the secret-wrapping key is missing in production.
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { authenticator } from 'otplib';

// ±1 step (30s) tolerance — accepts the previous, current, and next code.
authenticator.options = { window: 1 };

export interface MfaEnrollment {
  /** Base32 TOTP secret — encrypt before storing. */
  secret: string;
  /** otpauth:// URI for QR rendering. */
  otpauthUri: string;
  /** 10 single-use recovery codes — show once at enrollment, then store hashed. */
  recoveryCodes: string[];
}

export interface GenerateMfaEnrollmentInput {
  /** User-facing label (typically the email). */
  accountName: string;
  /** App label, e.g. 'AI Secretary'. */
  issuer: string;
}

export const generateMfaEnrollment = (input: GenerateMfaEnrollmentInput): MfaEnrollment => {
  const secret = authenticator.generateSecret();
  const otpauthUri = authenticator.keyuri(input.accountName, input.issuer, secret);
  return {
    secret,
    otpauthUri,
    recoveryCodes: generateRecoveryCodes(),
  };
};

export interface VerifyTotpInput {
  secret: string;
  token: string;
}

export const verifyTotpToken = (input: VerifyTotpInput): boolean => {
  if (typeof input.token !== 'string' || input.token.trim().length === 0) return false;
  // `authenticator.check` returns false on invalid base32 / wrong length
  // / out-of-window; it never throws on bad input. Wrap defensively so
  // any future library change doesn't surface a 500 to the caller.
  try {
    return authenticator.check(input.token.trim(), input.secret);
  } catch {
    return false;
  }
};

const RECOVERY_CODE_GROUP_BYTES = 2; // 4 hex chars per group, 3 groups
const RECOVERY_CODE_GROUPS = 3;
const RECOVERY_CODE_DEFAULT_COUNT = 10;

const formatRecoveryCode = (raw: Buffer): string => {
  const hex = raw.toString('hex');
  const groups: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_GROUPS; i += 1) {
    groups.push(hex.slice(i * 4, (i + 1) * 4));
  }
  return groups.join('-');
};

export const generateRecoveryCodes = (count: number = RECOVERY_CODE_DEFAULT_COUNT): string[] => {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('generateRecoveryCodes: count must be a positive integer');
  }
  const codes = new Set<string>();
  // Loop until we have `count` unique codes — collision probability at
  // 48 bits is negligible, but the set guards against any chance.
  while (codes.size < count) {
    const buf = randomBytes(RECOVERY_CODE_GROUP_BYTES * RECOVERY_CODE_GROUPS);
    codes.add(formatRecoveryCode(buf));
  }
  return Array.from(codes);
};

/**
 * Hash a recovery code for storage. Recovery codes are high-entropy
 * pre-images (48 random bits), so a fast SHA-256 is sufficient — we
 * don't need argon2's slow-hash properties because brute-forcing the
 * hash space is already infeasible.
 *
 * Normalizes the code (lowercase, strip whitespace + dashes) so input
 * variations (the user typing 'A1B2C3D4E5F6' or 'a1b2-c3d4-e5f6') hash
 * to the same value.
 */
export const hashRecoveryCode = (code: string): string => {
  const normalized = code.replace(/[\s-]/g, '').toLowerCase();
  return createHash('sha256').update(normalized).digest('hex');
};

/**
 * Boot-time guard for the encryption key. API server calls this once
 * at startup so a missing key in production crashes the process before
 * any auth flow runs. In test/dev, a missing key is logged but
 * tolerated — the test suite injects a deterministic key.
 */
export const assertMfaEncryptionKey = (
  key: string | undefined,
  env: string | undefined,
): string => {
  if (key && key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return key;
  }
  if (env === 'production') {
    throw new Error(
      'MFA_SECRET_ENCRYPTION_KEY missing or invalid (need 64-char hex). Cannot start in production.',
    );
  }
  // Dev fallback — deterministic key derived from a fixed seed so
  // restarts don't lose enrollment state. Not safe for prod.
  // We log a clear warning at boot via the API plugin layer.
  return 'dev'.padEnd(64, '0');
};

/**
 * Generate a 5-minute MFA challenge ID — used as the `jti` claim on the
 * challenge JWT so we can revoke individual challenges if needed in a
 * future story (current design: stateless, expiry-only).
 */
export const newMfaChallengeId = (): string => randomUUID();
