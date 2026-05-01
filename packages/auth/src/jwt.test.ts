import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from './jwt.js';
import type { AuthUserClaim } from './types.js';

const SECRET = 'unit-test-secret-must-be-at-least-32-chars-long';

const sampleUser: AuthUserClaim = {
  userId: '11111111-1111-1111-1111-111111111111',
  tenantId: '22222222-2222-2222-2222-222222222222',
  region: 'us',
  role: 'org_admin',
};

describe('jwt', () => {
  it('sign + verify roundtrip exposes the same claims', async () => {
    const { token, expiresIn } = await signAccessToken({ user: sampleUser, secret: SECRET });
    expect(typeof token).toBe('string');
    expect(expiresIn).toBe(15 * 60);
    const payload = await verifyAccessToken(token, SECRET);
    expect(payload.sub).toBe(sampleUser.userId);
    expect(payload.tenantId).toBe(sampleUser.tenantId);
    expect(payload.region).toBe('us');
    expect(payload.role).toBe('org_admin');
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  it('verify rejects a token signed with a different secret', async () => {
    const { token } = await signAccessToken({ user: sampleUser, secret: SECRET });
    const otherSecret = 'a-totally-different-secret-of-32-or-more-characters';
    await expect(verifyAccessToken(token, otherSecret)).rejects.toThrow();
  });

  it('verify rejects a tampered token', async () => {
    const { token } = await signAccessToken({ user: sampleUser, secret: SECRET });
    const parts = token.split('.');
    expect(parts.length).toBe(3);
    // Flip the last char of the signature segment.
    const sig = parts[2] ?? '';
    const tampered = `${parts[0]}.${parts[1]}.${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`;
    await expect(verifyAccessToken(tampered, SECRET)).rejects.toThrow();
  });

  it('verify rejects an expired token', async () => {
    const expiredAt = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    const { token } = await signAccessToken({
      user: sampleUser,
      secret: SECRET,
      ttlSeconds: 60, // 1m
      now: expiredAt,
    });
    await expect(verifyAccessToken(token, SECRET)).rejects.toThrow();
  });

  it('respects ttlSeconds override', async () => {
    const { expiresIn } = await signAccessToken({
      user: sampleUser,
      secret: SECRET,
      ttlSeconds: 120,
    });
    expect(expiresIn).toBe(120);
  });
});
