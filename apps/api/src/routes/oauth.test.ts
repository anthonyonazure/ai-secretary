import { describe, expect, it, vi } from 'vitest';

import type { Env } from '../env.js';
import { buildServer } from '../server.js';

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  HOST: '0.0.0.0',
  REGION: 'us',
  DATABASE_URL: 'postgres://localhost:5432/aisecretary_test',
  JWT_SECRET: 'test-secret-must-be-at-least-32-chars-long-please',
  JWT_MFA_CHALLENGE_SECRET: 'test-mfa-secret-must-be-at-least-32-chars-long-please',
  MFA_SECRET_ENCRYPTION_KEY: 'a'.repeat(64),
  OAUTH_REDIRECT_BASE_URL: 'http://localhost:3001',
  LOG_LEVEL: 'error',
};

describe('OAuth routes (Story 1.5b scaffold)', () => {
  it('GET /auth/oauth/:provider/start returns 503 when credentials are unset', async () => {
    const app = await buildServer({ env: TEST_ENV });
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/oauth/google/start' });
    expect(res.statusCode).toBe(503);
    expect(res.json().title).toBe('OAuth not configured');
    await app.close();
  });

  it('GET /auth/oauth/:provider/start returns the authorize URL when configured', async () => {
    const app = await buildServer({
      env: {
        ...TEST_ENV,
        GOOGLE_OAUTH_CLIENT_ID: 'test-google-client',
        GOOGLE_OAUTH_CLIENT_SECRET: 'test-google-secret',
      },
    });
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/oauth/google/start' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.authorizationUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(body.authorizationUrl).toContain('client_id=test-google-client');
    expect(body.authorizationUrl).toContain('code_challenge_method=S256');
    expect(body.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await app.close();
  });

  it('GET /auth/oauth/:provider/start rejects unknown providers', async () => {
    const app = await buildServer({ env: TEST_ENV });
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/oauth/bogus/start' });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('GET /auth/oauth/:provider/callback rejects mismatched state', async () => {
    const app = await buildServer({
      env: {
        ...TEST_ENV,
        GOOGLE_OAUTH_CLIENT_ID: 'test-google-client',
        GOOGLE_OAUTH_CLIENT_SECRET: 'test-google-secret',
      },
    });
    // No prior /start → state is unknown → forbidden.
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oauth/google/callback?code=abc&state=unknown-state-value',
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('POST /auth/oauth/:provider/exchange invokes the injected exchange fn', async () => {
    const exchange = vi.fn().mockResolvedValue({
      kind: 'session',
      accessToken: 'access',
      expiresIn: 900,
      refreshToken: 'refresh',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'oauth@example.test',
        name: 'OAuth User',
        role: 'org_admin',
        tenantId: '22222222-2222-4222-8222-222222222222',
        region: 'us',
        isMfaEnabled: false,
      },
      created: true,
    });
    const app = await buildServer({
      env: {
        ...TEST_ENV,
        GOOGLE_OAUTH_CLIENT_ID: 'test-google-client',
        GOOGLE_OAUTH_CLIENT_SECRET: 'test-google-secret',
      },
      oauthExchange: exchange,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/google/exchange',
      payload: { code: 'mobile-pkce-code', codeVerifier: 'verifier-here' },
    });
    expect(res.statusCode).toBe(200);
    expect(exchange).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google', code: 'mobile-pkce-code' }),
    );
    expect(res.json().created).toBe(true);
    await app.close();
  });

  it('POST /auth/oauth/:provider/exchange returns 503 when credentials missing', async () => {
    const app = await buildServer({ env: TEST_ENV });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/microsoft/exchange',
      payload: { code: 'abc' },
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});
