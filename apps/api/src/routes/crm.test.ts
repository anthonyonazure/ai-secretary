import { randomUUID } from 'node:crypto';
import { InMemoryRefreshTokenStore } from '@aisecretary/auth';
import { describe, expect, it } from 'vitest';

import type { Env } from '../env.js';
import { InMemoryCrmPushEnqueuer } from '../lib/crm-push-enqueue.js';
import { buildServer } from '../server.js';
import type {
  AuthRepository,
  AuthTenantRow,
  AuthUserRow,
  CreateTenantInput,
  CreateUserInput,
} from './auth-repository.js';
import { InMemoryCrmIntegrationsRepository } from './crm-repository.js';

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  HOST: '0.0.0.0',
  REGION: 'us',
  DATABASE_URL: 'postgres://localhost:5432/aisecretary_test',
  JWT_SECRET: 'test-secret-must-be-at-least-32-chars-long-please',
  JWT_MFA_CHALLENGE_SECRET: 'test-mfa-challenge-secret-min-32-chars-long',
  OAUTH_REDIRECT_BASE_URL: 'http://localhost:3001',
  LOG_LEVEL: 'error',
  S3_BUCKET: 'aisecretary-test',
  S3_REGION: 'us-east-1',
  S3_FORCE_PATH_STYLE: false,
  APP_BASE_URL: 'http://localhost:3001',
};

class InMemoryAuthRepository implements AuthRepository {
  public readonly users = new Map<string, AuthUserRow>();
  public readonly tenants = new Map<string, AuthTenantRow>();
  async findUserByEmail(email: string) {
    for (const u of this.users.values()) if (u.email === email.toLowerCase()) return u;
    return null;
  }
  async findUserById(userId: string) {
    return this.users.get(userId) ?? null;
  }
  async findTenantById(tenantId: string) {
    return this.tenants.get(tenantId) ?? null;
  }
  async createTenant(input: CreateTenantInput): Promise<AuthTenantRow> {
    const row: AuthTenantRow = {
      id: randomUUID(),
      name: input.name,
      slug: input.slug,
      region: input.region,
    };
    this.tenants.set(row.id, row);
    return row;
  }
  async createUser(input: CreateUserInput): Promise<AuthUserRow> {
    const row: AuthUserRow = {
      id: randomUUID(),
      tenantId: input.tenantId,
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role,
      passwordHash: input.passwordHash,
      isMfaEnabled: false,
    };
    this.users.set(row.id, row);
    return row;
  }
  async touchLastLogin(): Promise<void> {}
}

const signupBody = {
  tenantName: 'Acme Inc',
  region: 'us' as const,
  email: 'admin@acme.test',
  password: 'super-strong-password-1!',
  name: 'Admin User',
};

const buildApp = async () => {
  const authRepo = new InMemoryAuthRepository();
  const crmRepo = new InMemoryCrmIntegrationsRepository();
  const enqueuer = new InMemoryCrmPushEnqueuer();
  const refreshStore = new InMemoryRefreshTokenStore();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: authRepo,
    crmIntegrationsRepository: crmRepo,
    crmPushEnqueuer: enqueuer,
    refreshStore,
    consentChecker: async () => 'ok',
  });
  return { app, crmRepo, enqueuer };
};

const signupAndAuth = async (app: Awaited<ReturnType<typeof buildApp>>['app']) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: signupBody,
  });
  const body = res.json();
  return {
    accessToken: body.accessToken as string,
    tenantId: body.user.tenantId as string,
    userId: body.user.id as string,
  };
};

describe('GET /api/v1/crm/integrations', () => {
  it('returns an empty list initially', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/crm/integrations',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [] });
    await app.close();
  });
});

describe('POST /api/v1/crm/integrations/:provider', () => {
  it('connects a HubSpot integration in test mode (mock provider) and returns 201', async () => {
    const { app, crmRepo } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/crm/integrations/hubspot',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        accessToken: 'hs-token-123',
        refreshToken: 'hs-refresh-456',
        scopes: ['crm.objects.contacts.write', 'crm.objects.notes.write'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.provider).toBe('hubspot');
    // In test mode, the gateway routes to MockCrmProvider.whoAmI() which
    // returns the canned 'Mock CRM Account'.
    expect(body.accountLabel).toMatch(/Mock CRM/);
    expect(body.status).toBe('active');
    expect('encrypted_token' in body).toBe(false);
    expect('accessToken' in body).toBe(false);

    expect(crmRepo.rows).toHaveLength(1);
    expect(crmRepo.rows[0]?.tokens.accessToken).toBe('hs-token-123');
    await app.close();
  });

  it('rejects invalid provider in path with 422', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/crm/integrations/oracle',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { accessToken: 'token' },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('requires instanceUrl for salesforce', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/crm/integrations/salesforce',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { accessToken: 'sf-token' },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('requires apiBaseUrl for pipedrive', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/crm/integrations/pipedrive',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { accessToken: 'pd-token' },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/crm/integrations/hubspot',
      payload: { accessToken: 't' },
    });
    expect([401, 403]).toContain(res.statusCode);
    await app.close();
  });
});

describe('DELETE /api/v1/crm/integrations/:integrationId', () => {
  it('soft-revokes a connected integration', async () => {
    const { app, crmRepo } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/crm/integrations/hubspot',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { accessToken: 't', scopes: [] },
    });
    const integrationId = create.json().id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/crm/integrations/${integrationId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('revoked');
    expect(crmRepo.rows[0]?.status).toBe('revoked');
    await app.close();
  });

  it('returns 404 for a missing integration', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/crm/integrations/${randomUUID()}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('POST /api/v1/crm/push', () => {
  it('enqueues a crm.push job with a deterministic idempotency key', async () => {
    const { app, enqueuer } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/crm/integrations/hubspot',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { accessToken: 't', scopes: [] },
    });
    const integrationId = create.json().id;
    const meetingId = randomUUID();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/crm/push',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        integrationId,
        meetingId,
        contactEmail: 'jane@acme.com',
      },
    });
    expect(res.statusCode).toBe(202);
    expect(enqueuer.jobs).toHaveLength(1);
    expect(enqueuer.jobs[0]?.payload.idempotencyKey).toBe(
      `${meetingId}:${integrationId}:jane@acme.com`,
    );
    await app.close();
  });

  it('rejects push to a revoked integration with 403', async () => {
    const { app, crmRepo } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/crm/integrations/hubspot',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { accessToken: 't', scopes: [] },
    });
    const integrationId = create.json().id;
    const row = crmRepo.rows[0];
    if (row) row.status = 'revoked';

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/crm/push',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        integrationId,
        meetingId: randomUUID(),
        contactEmail: 'a@a.com',
      },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
