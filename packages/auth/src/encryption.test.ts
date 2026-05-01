/**
 * Story 1.5c — encryption tests.
 *
 * AES-256-GCM roundtrip + tamper detection + serialization.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  decryptSecret,
  deserializeEncryptedSecret,
  encryptSecret,
  serializeEncryptedSecret,
  setDeterministicIvForTests,
} from './encryption.js';

const KEY = 'a'.repeat(64);

afterEach(() => setDeterministicIvForTests(null));

describe('encryptSecret / decryptSecret', () => {
  it('roundtrips a TOTP-shaped secret', () => {
    const wrapped = encryptSecret('JBSWY3DPEHPK3PXP', KEY);
    expect(wrapped.v).toBe(1);
    expect(wrapped.ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(wrapped.iv).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(wrapped.authTag).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(decryptSecret(wrapped, KEY)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('two encryptions of the same plaintext yield different ciphertexts (random IV)', () => {
    const a = encryptSecret('hello', KEY);
    const b = encryptSecret('hello', KEY);
    expect(a.ciphertext === b.ciphertext && a.iv === b.iv).toBe(false);
  });

  it('deterministic IV (test mode) yields stable ciphertext', () => {
    setDeterministicIvForTests('00'.repeat(12));
    const a = encryptSecret('hello', KEY);
    const b = encryptSecret('hello', KEY);
    expect(a.ciphertext).toBe(b.ciphertext);
    expect(a.iv).toBe(b.iv);
  });

  it('rejects a tampered ciphertext', () => {
    const wrapped = encryptSecret('hello', KEY);
    // Flip the first byte of the ciphertext — base64 decode is forgiving,
    // so concatenating bytes can round-trip cleanly. XOR-flipping the
    // first decoded byte guarantees the GCM authTag check fails.
    const decoded = Buffer.from(wrapped.ciphertext, 'base64');
    decoded[0] = (decoded[0] ?? 0) ^ 0xff;
    const tampered = {
      ...wrapped,
      ciphertext: decoded.toString('base64'),
    };
    expect(() => decryptSecret(tampered, KEY)).toThrow();
  });

  it('rejects a wrong key', () => {
    const wrapped = encryptSecret('hello', KEY);
    const wrongKey = 'b'.repeat(64);
    expect(() => decryptSecret(wrapped, wrongKey)).toThrow();
  });

  it('rejects a malformed key (length / non-hex)', () => {
    expect(() => encryptSecret('x', 'short')).toThrow();
    expect(() => encryptSecret('x', 'z'.repeat(64))).toThrow();
  });

  it('rejects an unsupported payload version', () => {
    const wrapped = encryptSecret('hello', KEY);
    expect(() => decryptSecret({ ...wrapped, v: 2 as unknown as 1 }, KEY)).toThrow(
      /Unsupported encrypted payload version/,
    );
  });
});

describe('serializeEncryptedSecret / deserializeEncryptedSecret', () => {
  it('roundtrips through JSON', () => {
    const wrapped = encryptSecret('hello', KEY);
    const blob = serializeEncryptedSecret(wrapped);
    const back = deserializeEncryptedSecret(blob);
    expect(back).toEqual(wrapped);
    expect(decryptSecret(back, KEY)).toBe('hello');
  });

  it('rejects malformed JSON payloads', () => {
    expect(() => deserializeEncryptedSecret('{}')).toThrow();
    expect(() =>
      deserializeEncryptedSecret(JSON.stringify({ ciphertext: 'a', iv: 'b', authTag: 'c' })),
    ).toThrow();
  });
});
