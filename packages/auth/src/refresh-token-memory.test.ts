import { describe, expect, it } from 'vitest';
import { InMemoryRefreshTokenStore } from './refresh-token-memory.js';
import { generateRefreshToken } from './refresh-token.js';

const inFuture = (seconds: number): Date => new Date(Date.now() + seconds * 1000);

describe('InMemoryRefreshTokenStore', () => {
  it('save + lookup roundtrip', async () => {
    const store = new InMemoryRefreshTokenStore();
    const token = generateRefreshToken();
    await store.save({
      token,
      userId: 'u1',
      tenantId: 't1',
      expiresAt: inFuture(60),
    });
    const record = await store.lookup(token);
    expect(record?.userId).toBe('u1');
    expect(record?.tenantId).toBe('t1');
    expect(record?.token).toBe(token);
  });

  it('lookup returns null for unknown token', async () => {
    const store = new InMemoryRefreshTokenStore();
    expect(await store.lookup('nope')).toBeNull();
  });

  it('lookup returns null when token is expired', async () => {
    const store = new InMemoryRefreshTokenStore();
    const token = generateRefreshToken();
    await store.save({
      token,
      userId: 'u1',
      tenantId: 't1',
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await store.lookup(token)).toBeNull();
  });

  it('rotate invalidates the old token and writes the new one', async () => {
    const store = new InMemoryRefreshTokenStore();
    const oldT = generateRefreshToken();
    const newT = generateRefreshToken();
    await store.save({ token: oldT, userId: 'u1', tenantId: 't1', expiresAt: inFuture(60) });

    const result = await store.rotate(oldT, { token: newT, expiresAt: inFuture(120) });
    expect(result).not.toBeNull();
    expect(result?.userId).toBe('u1');
    expect(await store.lookup(oldT)).toBeNull();
    const newRecord = await store.lookup(newT);
    expect(newRecord?.userId).toBe('u1');
    expect(newRecord?.tenantId).toBe('t1');
  });

  it('rotate returns null when the old token is unknown', async () => {
    const store = new InMemoryRefreshTokenStore();
    const result = await store.rotate('does-not-exist', {
      token: 'new',
      expiresAt: inFuture(60),
    });
    expect(result).toBeNull();
    expect(await store.lookup('new')).toBeNull();
  });

  it('revoke removes the token', async () => {
    const store = new InMemoryRefreshTokenStore();
    const token = generateRefreshToken();
    await store.save({ token, userId: 'u1', tenantId: 't1', expiresAt: inFuture(60) });
    await store.revoke(token);
    expect(await store.lookup(token)).toBeNull();
  });

  it('revokeAllForUser clears every token for that user', async () => {
    const store = new InMemoryRefreshTokenStore();
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    const c = generateRefreshToken();
    await store.save({ token: a, userId: 'u1', tenantId: 't1', expiresAt: inFuture(60) });
    await store.save({ token: b, userId: 'u1', tenantId: 't1', expiresAt: inFuture(60) });
    await store.save({ token: c, userId: 'u2', tenantId: 't1', expiresAt: inFuture(60) });
    await store.revokeAllForUser('u1');
    expect(await store.lookup(a)).toBeNull();
    expect(await store.lookup(b)).toBeNull();
    expect(await store.lookup(c)).not.toBeNull();
  });

  it('generateRefreshToken returns base64url 256-bit strings', () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
