import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('hash + verify roundtrip succeeds', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('verify fails for wrong password', async () => {
    const hash = await hashPassword('s3cret-passw0rd!');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('verify returns false (never throws) for malformed hash', async () => {
    expect(await verifyPassword('whatever', 'not-a-valid-hash')).toBe(false);
  });

  it('produces unique hashes for the same input (random salt)', async () => {
    const a = await hashPassword('repeat-me-please');
    const b = await hashPassword('repeat-me-please');
    expect(a).not.toBe(b);
    expect(await verifyPassword('repeat-me-please', a)).toBe(true);
    expect(await verifyPassword('repeat-me-please', b)).toBe(true);
  });
});
