import { randomUUID } from 'node:crypto';
import { InMemoryRefreshTokenStore } from '@aisecretary/auth';
import { describe, expect, it } from 'vitest';
import type { Env } from '../env.js';
import { buildServer } from '../server.js';
import type {
  AuthRepository,
  AuthTenantRow,
  AuthUserRow,
  CreateTenantInput,
  CreateUserInput,
} from './auth-repository.js';
import { InMemoryCrossOrgPolicyRepository } from './cross-org-policy-repository.js';

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  HOST: '0.0.0.0',
  REGION: 'us',
  DATABASE_URL: 'postgres://localhost:5432/aisecretary_test',
  JWT_SECRET: 'test-secret-must-be-at-least-32-chars-long-please',
  LOG_LEVEL: 'error',
};

class InMemoryAuthRepository implements AuthRepository {
  public readonly users = new Map<string, AuthUserRow>();
  public readonly tenants = new Map<string, AuthTenantRow>();
  async findUserByEmail(email: string): Promise<AuthUserRow | null> {
    for (const u of this.users.values()) if (u.email === email.toLowerCase()) return u;
    return null;
  }
  async findUserById(userId: string): Promise<AuthUserRow | null> {
    return this.users.get(userId) ?? null;
  }
  async findTenantById(tenantId: string): Promise<AuthTenantRow | null> {
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

const adminSignup = {
  tenantName: 'Acme Inc',
  region: 'us' as const,
  email: 'admin@acme.test',
  password: 'super-strong-password-1!',
  name: 'Admin User',
};

const buildApp = async () => {
  const policyRepo = new InMemoryCrossOrgPolicyRepository();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: new InMemoryAuthRepository(),
    crossOrgPolicyRepository: policyRepo,
    refreshStore: new InMemoryRefreshTokenStore(),
    consentChecker: async () => 'ok',
  });
  return { app, policyRepo };
};

const signupAndAuth = async (app: Awaited<ReturnType<typeof buildApp>>['app']) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: adminSignup,
  });
  const body = res.json();
  return { accessToken: body.accessToken as string, tenantId: body.user.tenantId as string };
};

describe('Cross-org accept-policy', () => {
  it('GET / returns the default accept-all policy', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/tenants/me/cross-org-policy',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.kind).toBe('accept-all');
    expect(body.whitelist).toEqual([]);
    await app.close();
  });

  it('PUT / upserts a whitelist policy', async () => {
    const { app, policyRepo } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/tenants/me/cross-org-policy',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { kind: 'whitelist', whitelist: ['Partner.example', 'trusted.io'] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.kind).toBe('whitelist');
    expect(body.whitelist).toEqual(['partner.example', 'trusted.io']);
    expect(policyRepo.rows.get(tenantId)?.kind).toBe('whitelist');
    await app.close();
  });

  it('PUT / rejects an empty whitelist on whitelist policy', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/tenants/me/cross-org-policy',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { kind: 'whitelist', whitelist: [] },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('PUT / accepts block-all policy', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/tenants/me/cross-org-policy',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { kind: 'block-all' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().kind).toBe('block-all');
    await app.close();
  });

  it('evaluate() honours whitelist policy correctly', async () => {
    const repo = new InMemoryCrossOrgPolicyRepository();
    const tenantId = randomUUID();
    await repo.upsert({ tenantId, kind: 'whitelist', whitelist: ['partner.example'] });
    const ok = await repo.evaluate({ tenantId, senderDomain: 'partner.example' });
    expect(ok.accepted).toBe(true);
    expect(ok.reason).toBe('whitelist-match');
    const ng = await repo.evaluate({ tenantId, senderDomain: 'unknown.example' });
    expect(ng.accepted).toBe(false);
    expect(ng.reason).toBe('whitelist-miss');
  });

  it('evaluate() blocks all when policy is block-all', async () => {
    const repo = new InMemoryCrossOrgPolicyRepository();
    const tenantId = randomUUID();
    await repo.upsert({ tenantId, kind: 'block-all' });
    const result = await repo.evaluate({ tenantId, senderDomain: 'partner.example' });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('block-all');
  });
});
