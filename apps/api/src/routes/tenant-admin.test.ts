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
import { InMemoryTenantAdminRepository } from './tenant-admin-repository.js';

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
  const adminRepo = new InMemoryTenantAdminRepository();
  const refreshStore = new InMemoryRefreshTokenStore();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: authRepo,
    tenantAdminRepository: adminRepo,
    refreshStore,
    consentChecker: async () => 'ok',
  });
  return { app, adminRepo };
};

const signupAndAuth = async (
  app: Awaited<ReturnType<typeof buildApp>>['app'],
  adminRepo: InMemoryTenantAdminRepository,
) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: adminSignup,
  });
  const body = res.json();
  // Seed the in-memory tenant admin repo with the freshly-created
  // tenant so the F2-admin endpoints have a row to work against.
  adminRepo.seed({
    id: body.user.tenantId,
    state: 'dpa_required',
    region: 'us',
    dpaVersion: null,
    dpaAcceptedAt: null,
    regionLockedAt: null,
  });
  return {
    accessToken: body.accessToken as string,
    tenantId: body.user.tenantId as string,
  };
};

describe('GET /api/v1/tenants/me/state', () => {
  it('returns the current state + completed-steps', async () => {
    const { app, adminRepo } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app, adminRepo);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/tenants/me/state',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tenantId).toBe(tenantId);
    expect(body.state).toBe('dpa_required');
    expect(body.dpaAccepted).toBe(false);
    expect(body.regionPinned).toBe(false);
    expect(body.completedSteps).toEqual([]);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/tenants/me/state' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('POST /api/v1/tenants/me/dpa', () => {
  it('flips state to dpa_accepted + records the version', async () => {
    const { app, adminRepo } = await buildApp();
    const { accessToken } = await signupAndAuth(app, adminRepo);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tenants/me/dpa',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { dpaVersion: '2026-04' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.state).toBe('dpa_accepted');
    expect(body.dpaAccepted).toBe(true);
    expect(body.completedSteps).toContain('dpa');
    await app.close();
  });

  it('rejects an empty dpaVersion (422)', async () => {
    const { app, adminRepo } = await buildApp();
    const { accessToken } = await signupAndAuth(app, adminRepo);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tenants/me/dpa',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { dpaVersion: '' },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });
});

describe('POST /api/v1/tenants/me/region', () => {
  it('pins the region and transitions to provisioning', async () => {
    const { app, adminRepo } = await buildApp();
    const { accessToken } = await signupAndAuth(app, adminRepo);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tenants/me/region',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { region: 'eu' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.state).toBe('provisioning');
    expect(body.region).toBe('eu');
    expect(body.regionPinned).toBe(true);
    expect(body.completedSteps).toContain('region');
    await app.close();
  });

  it('returns 409 on a second region-pin attempt', async () => {
    const { app, adminRepo } = await buildApp();
    const { accessToken } = await signupAndAuth(app, adminRepo);
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/tenants/me/region',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { region: 'us' },
    });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/tenants/me/region',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { region: 'eu' },
    });
    expect(second.statusCode).toBe(409);
    await app.close();
  });
});
