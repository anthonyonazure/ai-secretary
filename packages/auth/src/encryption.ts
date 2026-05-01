/**
 * AES-256-GCM symmetric encryption for "at-rest" secrets that the server
 * needs to read back (vs. one-way hashes like passwords or recovery
 * codes). Story 1.5c uses this for the per-user TOTP secret —
 * `users.mfa_secret_encrypted` stores the wrapped JSON payload produced
 * by `encryptSecret`; `decryptSecret` reverses it at TOTP-verify time.
 *
 * Key source: `MFA_SECRET_ENCRYPTION_KEY` (32-byte hex string). In
 * production this comes from a sealed secret manager (Railway / AWS
 * Secrets Manager). Tests can pass any 64-char hex string.
 *
 * Format choice — wrap as JSON:
 *   { ciphertext, iv, authTag }  // all base64
 * keeps the single `text` column readable and lets us evolve the
 * algorithm by adding a `v` field without a schema migration.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_BYTES = 16;

export interface EncryptedSecretPayload {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
  /** Wrapping format version — bumped if we change the algorithm. */
  v: 1;
}

const decodeKey = (key: string): Buffer => {
  if (typeof key !== 'string' || key.length !== KEY_BYTES * 2) {
    throw new Error(
      `MFA_SECRET_ENCRYPTION_KEY must be ${KEY_BYTES * 2}-char hex (got ${key?.length ?? 0}).`,
    );
  }
  // `Buffer.from('zz', 'hex')` returns 0 bytes silently — guard explicitly.
  if (!/^[0-9a-fA-F]+$/.test(key)) {
    throw new Error('MFA_SECRET_ENCRYPTION_KEY must be hex-encoded.');
  }
  return Buffer.from(key, 'hex');
};

/**
 * Test-mode IV override — when set, `encryptSecret` uses the provided
 * 12-byte hex string instead of a random IV. Production code must NOT
 * call this — it's only exported for the encryption test suite which
 * needs deterministic ciphertext to assert exact bytes. Reset between
 * tests via `setDeterministicIvForTests(null)`.
 */
let DETERMINISTIC_IV: Buffer | null = null;
export const setDeterministicIvForTests = (hex: string | null): void => {
  if (hex === null) {
    DETERMINISTIC_IV = null;
    return;
  }
  if (hex.length !== IV_BYTES * 2 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`Test IV must be ${IV_BYTES * 2}-char hex.`);
  }
  DETERMINISTIC_IV = Buffer.from(hex, 'hex');
};

export const encryptSecret = (plaintext: string, key: string): EncryptedSecretPayload => {
  const keyBuf = decodeKey(key);
  const iv = DETERMINISTIC_IV ?? randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyBuf, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    v: 1,
  };
};

export const decryptSecret = (payload: EncryptedSecretPayload, key: string): string => {
  if (payload.v !== 1) {
    throw new Error(`Unsupported encrypted payload version: ${String(payload.v)}`);
  }
  const keyBuf = decodeKey(key);
  const iv = Buffer.from(payload.iv, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  if (iv.length !== IV_BYTES) {
    throw new Error('encrypted-secret: iv length invalid');
  }
  if (authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('encrypted-secret: authTag length invalid');
  }
  const decipher = createDecipheriv(ALGORITHM, keyBuf, iv);
  decipher.setAuthTag(authTag);
  // GCM tag mismatch surfaces as a thrown error from `final()`; let it
  // propagate so callers know the ciphertext was tampered with.
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
};

/**
 * Serialize an `EncryptedSecretPayload` for storage in a TEXT column.
 * JSON keeps the same payload portable between Postgres + tests + any
 * future sink (Vault, KMS-wrap, etc.).
 */
export const serializeEncryptedSecret = (payload: EncryptedSecretPayload): string =>
  JSON.stringify(payload);

export const deserializeEncryptedSecret = (raw: string): EncryptedSecretPayload => {
  const parsed = JSON.parse(raw) as unknown;
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { ciphertext?: unknown }).ciphertext !== 'string' ||
    typeof (parsed as { iv?: unknown }).iv !== 'string' ||
    typeof (parsed as { authTag?: unknown }).authTag !== 'string' ||
    (parsed as { v?: unknown }).v !== 1
  ) {
    throw new Error('encrypted-secret: malformed payload');
  }
  return parsed as EncryptedSecretPayload;
};
