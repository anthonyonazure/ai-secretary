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
import { InMemorySearchRepository } from './search-repository.js';

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
  const authRepo = new InMemoryAuthRepository();
  const searchRepo = new InMemorySearchRepository();
  const refreshStore = new InMemoryRefreshTokenStore();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: authRepo,
    searchRepository: searchRepo,
    refreshStore,
    consentChecker: async () => 'ok',
  });
  return { app, searchRepo };
};

const signupAndAuth = async (app: Awaited<ReturnType<typeof buildApp>>['app']) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: adminSignup,
  });
  const body = res.json();
  return {
    accessToken: body.accessToken as string,
    tenantId: body.user.tenantId as string,
  };
};

describe('GET /api/v1/search', () => {
  it('returns ranked snippets matching the query', async () => {
    const { app, searchRepo } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app);
    const meetingId = randomUUID();
    searchRepo.insert(tenantId, {
      meetingId,
      meetingTitle: 'Quarterly review',
      turnId: 'turn-1',
      speaker: 'Anthony',
      spanStartMs: 12_000,
      spanEndMs: 14_000,
      source: 'transcript',
      text: 'Their pricing question came up twice — let us anchor differently.',
    });
    searchRepo.insert(tenantId, {
      meetingId,
      meetingTitle: 'Quarterly review',
      turnId: 'turn-2',
      speaker: 'Casey',
      spanStartMs: 90_000,
      spanEndMs: 92_000,
      source: 'transcript',
      text: 'I think the pricing tier should be reconsidered for enterprise.',
    });
    searchRepo.insert(tenantId, {
      meetingId: randomUUID(),
      meetingTitle: 'One-on-one',
      turnId: 'turn-1',
      speaker: 'Anthony',
      spanStartMs: 0,
      spanEndMs: 1000,
      source: 'transcript',
      text: 'Wholly unrelated content about onboarding.',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=pricing',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.query).toBe('pricing');
    expect(body.items).toHaveLength(2);
    expect(body.items[0].snippet).toContain('<mark>pricing</mark>');
    expect(body.items[0].source).toBe('transcript');
    expect(typeof body.durationMs).toBe('number');
    await app.close();
  });

  it('filters by meeting id', async () => {
    const { app, searchRepo } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app);
    const m1 = randomUUID();
    const m2 = randomUUID();
    searchRepo.insert(tenantId, {
      meetingId: m1,
      meetingTitle: 'M1',
      turnId: 't1',
      speaker: null,
      spanStartMs: 0,
      spanEndMs: 1000,
      source: 'transcript',
      text: 'pricing came up',
    });
    searchRepo.insert(tenantId, {
      meetingId: m2,
      meetingTitle: 'M2',
      turnId: 't1',
      speaker: null,
      spanStartMs: 0,
      spanEndMs: 1000,
      source: 'transcript',
      text: 'pricing was mentioned',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/search?q=pricing&meetingId=${m1}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items).toHaveLength(1);
    expect(items[0].meetingId).toBe(m1);
    await app.close();
  });

  it('returns 422 on empty query string', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/search?q=test' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('does not return rows from another tenant', async () => {
    const { app, searchRepo } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const otherTenant = randomUUID();
    searchRepo.insert(otherTenant, {
      meetingId: randomUUID(),
      meetingTitle: 'Other tenant meeting',
      turnId: 't',
      speaker: null,
      spanStartMs: 0,
      spanEndMs: 0,
      source: 'transcript',
      text: 'pricing was discussed in another tenant',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=pricing',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(0);
    await app.close();
  });
});
