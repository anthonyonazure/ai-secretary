import { InMemoryRefreshTokenStore } from '@aisecretary/auth';
import { describe, expect, it } from 'vitest';
import type { Env } from '../env.js';
import { buildServer } from '../server.js';
import { InMemoryDsarPortalRepository } from './dsar-portal-repository.js';

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  HOST: '0.0.0.0',
  REGION: 'us',
  DATABASE_URL: 'postgres://localhost:5432/aisecretary_test',
  JWT_SECRET: 'test-secret-must-be-at-least-32-chars-long-please',
  LOG_LEVEL: 'error',
};

const buildApp = async () => {
  const portalRepo = new InMemoryDsarPortalRepository();
  const captured: Array<{ email: string; plaintextToken: string }> = [];
  const app = await buildServer({
    env: TEST_ENV,
    refreshStore: new InMemoryRefreshTokenStore(),
    consentChecker: async () => 'ok',
    dsarPortalRepository: portalRepo,
    dsarPortalEmailDispatcher: async (input) => {
      captured.push({ email: input.email, plaintextToken: input.plaintextToken });
    },
  });
  return { app, portalRepo, captured };
};

describe('public DSAR portal', () => {
  it('POST /submissions accepts a request and emits a verification email', async () => {
    const { app, portalRepo, captured } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/data-rights/submissions',
      payload: {
        kind: 'access',
        email: 'subject@example.com',
        fullName: 'Real Person',
        tenantSlug: 'acme',
        description: 'Please give me a copy of any data you hold about me.',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('pending-verification');
    expect(typeof body.verificationExpiresAt).toBe('string');
    expect(portalRepo.rows).toHaveLength(1);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.email).toBe('subject@example.com');
    // The plaintext token must NOT appear on the persisted row.
    const row = portalRepo.rows[0];
    if (!row) throw new Error('expected row');
    expect(row.verificationTokenHash.length).toBeGreaterThan(20);
    expect(row.verificationTokenHash).not.toBe(captured[0]?.plaintextToken);
    await app.close();
  });

  it('GET /submissions/:token/verify flips the row to verified', async () => {
    const { app, portalRepo, captured } = await buildApp();
    await app.inject({
      method: 'POST',
      url: '/api/v1/data-rights/submissions',
      payload: {
        kind: 'deletion',
        email: 'subject@example.com',
        fullName: 'Real Person',
        tenantSlug: 'acme',
        description: 'Please delete the data you hold about me under GDPR Art. 17.',
      },
    });
    const token = captured[0]?.plaintextToken;
    if (!token) throw new Error('expected token');
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/data-rights/submissions/${token}/verify`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('verified');
    expect(portalRepo.rows[0]?.status).toBe('verified');
    expect(portalRepo.rows[0]?.verifiedAt).not.toBeNull();
    await app.close();
  });

  it('GET /submissions/:token/verify returns 404 for an unknown token', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/data-rights/submissions/some-fake-token-that-is-long-enough/verify',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().status).toBe('expired');
    await app.close();
  });

  it('GET /submissions/:token/verify returns 410 once the verification window has passed', async () => {
    const { app, portalRepo, captured } = await buildApp();
    await app.inject({
      method: 'POST',
      url: '/api/v1/data-rights/submissions',
      payload: {
        kind: 'access',
        email: 'subject@example.com',
        fullName: 'Real Person',
        tenantSlug: 'acme',
        description: 'Please share what you have.',
      },
    });
    // Force the row to look expired.
    const row = portalRepo.rows[0];
    if (!row) throw new Error('expected row');
    row.verificationExpiresAt = new Date(Date.now() - 60_000);

    const token = captured[0]?.plaintextToken;
    if (!token) throw new Error('expected token');
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/data-rights/submissions/${token}/verify`,
    });
    expect(res.statusCode).toBe(410);
    expect(res.json().status).toBe('expired');
    await app.close();
  });

  it('returns 422 on a malformed payload (missing description)', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/data-rights/submissions',
      payload: {
        kind: 'access',
        email: 'subject@example.com',
        fullName: 'Real Person',
        tenantSlug: 'acme',
        description: 'too short',
      },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });
});
