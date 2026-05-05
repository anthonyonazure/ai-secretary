import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { StaticKekKeyring, decryptEnvelope, encryptEnvelope } from './envelope-encryption.js';

describe('StaticKekKeyring', () => {
  it('round-trips plaintext through encrypt/decrypt', async () => {
    const kek = randomBytes(32);
    const keyring = new StaticKekKeyring({
      currentKekId: 'kek-2026-05',
      keys: { 'kek-2026-05': kek },
    });
    const plaintext = JSON.stringify({ access_token: 'super-secret', refresh_token: 'r-1' });

    const envelope = await encryptEnvelope(keyring, plaintext);
    expect(envelope.alg).toBe('aes-256-gcm');
    expect(envelope.version).toBe(1);
    expect(envelope.kekId).toBe('kek-2026-05');
    expect(envelope.ciphertext).not.toContain('super-secret');

    const decrypted = await decryptEnvelope(keyring, envelope);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext (fresh DEK + IV)', async () => {
    const kek = randomBytes(32);
    const keyring = new StaticKekKeyring({
      currentKekId: 'kek-1',
      keys: { 'kek-1': kek },
    });
    const a = await encryptEnvelope(keyring, 'same plaintext');
    const b = await encryptEnvelope(keyring, 'same plaintext');
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.dek).not.toBe(b.dek);
    expect(a.iv).not.toBe(b.iv);
  });

  it('fails decryption when ciphertext is tampered (GCM auth tag mismatch)', async () => {
    const kek = randomBytes(32);
    const keyring = new StaticKekKeyring({
      currentKekId: 'kek-1',
      keys: { 'kek-1': kek },
    });
    const envelope = await encryptEnvelope(keyring, 'sensitive');
    const buf = Buffer.from(envelope.ciphertext, 'base64');
    buf[0] ^= 0xff;
    const tampered = { ...envelope, ciphertext: buf.toString('base64') };
    await expect(decryptEnvelope(keyring, tampered)).rejects.toThrow();
  });

  it('keeps retired KEKs readable for previously-wrapped envelopes', async () => {
    const oldKek = randomBytes(32);
    const newKek = randomBytes(32);
    const initialRing = new StaticKekKeyring({
      currentKekId: 'kek-old',
      keys: { 'kek-old': oldKek },
    });
    const envelope = await encryptEnvelope(initialRing, 'before rotation');

    // Rotate: new key is current, old key retained for unwrap.
    const rotatedRing = new StaticKekKeyring({
      currentKekId: 'kek-new',
      keys: { 'kek-old': oldKek, 'kek-new': newKek },
    });
    const decrypted = await decryptEnvelope(rotatedRing, envelope);
    expect(decrypted).toBe('before rotation');
  });

  it('throws when the wrapping KEK is no longer in the keyring', async () => {
    const oldKek = randomBytes(32);
    const initialRing = new StaticKekKeyring({
      currentKekId: 'kek-old',
      keys: { 'kek-old': oldKek },
    });
    const envelope = await encryptEnvelope(initialRing, 'lost forever');

    const newKek = randomBytes(32);
    const ringWithoutOld = new StaticKekKeyring({
      currentKekId: 'kek-new',
      keys: { 'kek-new': newKek },
    });
    await expect(decryptEnvelope(ringWithoutOld, envelope)).rejects.toThrow(/not in keyring/);
  });

  it('rejects KEKs that are not exactly 32 bytes', () => {
    expect(
      () =>
        new StaticKekKeyring({
          currentKekId: 'kek-bad',
          keys: { 'kek-bad': Buffer.alloc(16) },
        }),
    ).toThrow(/exactly 32 bytes/);
  });

  it('fromEnv requires AT_REST_KEK_CURRENT_ID', () => {
    expect(() => StaticKekKeyring.fromEnv({} as NodeJS.ProcessEnv)).toThrow(
      /AT_REST_KEK_CURRENT_ID/,
    );
  });

  it('fromEnv loads base64-encoded keys correctly', async () => {
    const kek = randomBytes(32);
    const ring = StaticKekKeyring.fromEnv({
      AT_REST_KEK_CURRENT_ID: 'kek-2026-05',
      'AT_REST_KEK_kek-2026-05': kek.toString('base64'),
    } as NodeJS.ProcessEnv);
    expect(ring.currentKekId()).toBe('kek-2026-05');
    const envelope = await encryptEnvelope(ring, 'hello');
    expect(await decryptEnvelope(ring, envelope)).toBe('hello');
  });
});
