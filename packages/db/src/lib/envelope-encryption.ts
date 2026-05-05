/**
 * KMS-style envelope encryption for tenant_integrations OAuth tokens
 * (and any other at-rest secret JSON we want field-level encrypted).
 *
 * Pattern (matches AWS KMS / GCP KMS standard envelope):
 *   1. Generate a fresh per-row Data Encryption Key (DEK) — 256 bits.
 *   2. Encrypt the plaintext JSON with the DEK using AES-256-GCM.
 *   3. Wrap the DEK with the at-rest Key Encryption Key (KEK) using
 *      AES-256-GCM (separate IV).
 *   4. Persist the ciphertext + wrapped-DEK + IVs + tag + KEK id +
 *      version as a JSONB envelope.
 *   5. To decrypt: unwrap DEK with current KEK (looked up by `kekId`),
 *      then decrypt ciphertext.
 *
 * KEK rotation:
 *   - The `KekKeyring` exposes a current KEK + any retired KEKs.
 *   - Decryption looks up the wrapping KEK by id (so retired keys keep
 *     existing rows readable).
 *   - Re-wrap is a separate per-row job — out of scope for this module.
 *
 * In production, the KEK lives in AWS KMS / GCP KMS / HashiCorp Vault
 * and the `wrapDek` / `unwrapDek` calls go through the KMS API. The
 * portfolio scaffold uses a static keyring from env (AT_REST_KEK_*)
 * that mirrors the same interface so the swap is a single class
 * substitution.
 */

import { type CipherGCMTypes, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM: CipherGCMTypes = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface EncryptedEnvelope {
  ciphertext: string;
  dek: string;
  iv: string;
  tag: string;
  kekId: string;
  alg: 'aes-256-gcm';
  version: 1;
}

/**
 * KEK-management interface. `wrapDek` / `unwrapDek` correspond to
 * `kms.Encrypt` / `kms.Decrypt` in cloud KMS. The static
 * `StaticKekKeyring` impl is for portfolio + dev. Production wires a
 * KMS-backed implementation that satisfies this same surface.
 */
export interface KekKeyring {
  /** Current KEK id used for new wrap operations. */
  currentKekId(): string;
  /** Wrap a DEK. Returns the wrapped DEK + its IV + auth tag, plus the
   *  KEK id used. */
  wrapDek(dek: Buffer): Promise<{ wrapped: Buffer; iv: Buffer; tag: Buffer; kekId: string }>;
  /** Unwrap a DEK using the named KEK. */
  unwrapDek(input: { wrapped: Buffer; iv: Buffer; tag: Buffer; kekId: string }): Promise<Buffer>;
}

/**
 * Static keyring backed by 32-byte raw keys from env. Mirrors the KMS
 * interface so swapping in a real KMS implementation is one line.
 *
 * Env contract:
 *   AT_REST_KEK_CURRENT_ID   = e.g. 'kek-2026-01'
 *   AT_REST_KEK_<id>         = base64-encoded 32-byte key per id
 */
export class StaticKekKeyring implements KekKeyring {
  private readonly current: string;
  private readonly keys: Map<string, Buffer>;

  constructor(input: { currentKekId: string; keys: Record<string, Buffer> }) {
    if (!input.keys[input.currentKekId]) {
      throw new Error(
        `StaticKekKeyring: current KEK id '${input.currentKekId}' has no key in keyring.`,
      );
    }
    for (const [id, k] of Object.entries(input.keys)) {
      if (k.length !== KEY_BYTES) {
        throw new Error(
          `StaticKekKeyring: KEK '${id}' must be exactly ${KEY_BYTES} bytes (got ${k.length}).`,
        );
      }
    }
    this.current = input.currentKekId;
    this.keys = new Map(Object.entries(input.keys));
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): StaticKekKeyring {
    const currentId = env.AT_REST_KEK_CURRENT_ID;
    if (!currentId) {
      throw new Error(
        'StaticKekKeyring.fromEnv: AT_REST_KEK_CURRENT_ID is required for at-rest encryption.',
      );
    }
    const keys: Record<string, Buffer> = {};
    const prefix = 'AT_REST_KEK_';
    for (const [k, v] of Object.entries(env)) {
      if (!k.startsWith(prefix) || k === 'AT_REST_KEK_CURRENT_ID') continue;
      const id = k.slice(prefix.length).toLowerCase();
      if (!v) continue;
      const buf = Buffer.from(v, 'base64');
      if (buf.length !== KEY_BYTES) {
        throw new Error(
          `StaticKekKeyring.fromEnv: ${k} must decode to exactly ${KEY_BYTES} bytes.`,
        );
      }
      keys[id] = buf;
    }
    return new StaticKekKeyring({ currentKekId: currentId.toLowerCase(), keys });
  }

  currentKekId(): string {
    return this.current;
  }

  async wrapDek(dek: Buffer): Promise<{ wrapped: Buffer; iv: Buffer; tag: Buffer; kekId: string }> {
    const kekId = this.current;
    const kek = this.requireKey(kekId);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, kek, iv);
    const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { wrapped, iv, tag, kekId };
  }

  async unwrapDek(input: {
    wrapped: Buffer;
    iv: Buffer;
    tag: Buffer;
    kekId: string;
  }): Promise<Buffer> {
    const kek = this.requireKey(input.kekId);
    const decipher = createDecipheriv(ALGORITHM, kek, input.iv);
    decipher.setAuthTag(input.tag);
    return Buffer.concat([decipher.update(input.wrapped), decipher.final()]);
  }

  private requireKey(kekId: string): Buffer {
    const k = this.keys.get(kekId);
    if (!k) {
      throw new Error(
        `StaticKekKeyring: KEK '${kekId}' not in keyring (cannot decrypt rows wrapped with retired key).`,
      );
    }
    return k;
  }
}

/**
 * Encrypt a plaintext JSON string into an envelope. The plaintext
 * never crosses the trust boundary in the clear — the in-memory DEK
 * is generated locally and zeroed after wrap.
 */
export const encryptEnvelope = async (
  keyring: KekKeyring,
  plaintext: string,
): Promise<EncryptedEnvelope> => {
  const dek = randomBytes(KEY_BYTES);
  try {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, dek, iv);
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(plaintext, 'utf8')),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    if (tag.length !== TAG_BYTES) {
      throw new Error(`encryptEnvelope: unexpected auth tag length ${tag.length}`);
    }

    const wrapped = await keyring.wrapDek(dek);

    return {
      ciphertext: ciphertext.toString('base64'),
      dek: wrappedToBase64(wrapped),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      kekId: wrapped.kekId,
      alg: 'aes-256-gcm',
      version: 1,
    };
  } finally {
    dek.fill(0);
  }
};

export const decryptEnvelope = async (
  keyring: KekKeyring,
  envelope: EncryptedEnvelope,
): Promise<string> => {
  if (envelope.alg !== 'aes-256-gcm' || envelope.version !== 1) {
    throw new Error(`decryptEnvelope: unsupported envelope ${envelope.alg}/v${envelope.version}`);
  }
  const wrapped = wrappedFromBase64(envelope.dek, envelope.kekId);
  const dek = await keyring.unwrapDek(wrapped);
  try {
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
    const decipher = createDecipheriv(ALGORITHM, dek, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } finally {
    dek.fill(0);
  }
};

/** Pack `{ wrapped, iv, tag, kekId }` into a single base64 string. */
const wrappedToBase64 = (input: {
  wrapped: Buffer;
  iv: Buffer;
  tag: Buffer;
  kekId: string;
}): string => {
  // Format: <iv:12B><tag:16B><wrapped:N>
  const merged = Buffer.concat([input.iv, input.tag, input.wrapped]);
  return merged.toString('base64');
};

const wrappedFromBase64 = (
  input: string,
  kekId: string,
): { wrapped: Buffer; iv: Buffer; tag: Buffer; kekId: string } => {
  const buf = Buffer.from(input, 'base64');
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error(`decryptEnvelope: dek field too short (${buf.length} bytes)`);
  }
  return {
    iv: buf.subarray(0, IV_BYTES),
    tag: buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES),
    wrapped: buf.subarray(IV_BYTES + TAG_BYTES),
    kekId,
  };
};
