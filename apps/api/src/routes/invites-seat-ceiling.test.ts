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
import { InMemoryInvitesRepository } from './invites-repository.js';

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

const buildApp = async (
  seatCheck:
    | ((input: {
        tenantId: string;
      }) => Promise<{ allowed: true } | { allowed: false; ceiling: number; current: number }>)
    | undefined,
) => {
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: new InMemoryAuthRepository(),
    invitesRepository: new InMemoryInvitesRepository(),
    refreshStore: new InMemoryRefreshTokenStore(),
    consentChecker: async () => 'ok',
    ...(seatCheck ? { seatCeilingCheck: seatCheck } : {}),
  });
  return app;
};

const signupAndAuth = async (app: Awaited<ReturnType<typeof buildApp>>) => {
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

describe('Story 13.3 — seat ceiling enforcement on invite create', () => {
  it('rejects with 403 + upsell hint when the seat ceiling is reached', async () => {
    const seatCheck = async () => ({ allowed: false, ceiling: 1, current: 1 }) as const;
    const app = await buildApp(seatCheck);
    const { accessToken, tenantId } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${tenantId}/invites`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { email: 'new-seat@acme.test', role: 'org_member' },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('seat-ceiling-reached');
    expect(body.ceiling).toBe(1);
    expect(body.upsell).toMatchObject({ minimumTier: 'pro', feature: 'seats' });
    await app.close();
  });

  it('lets the invite through when the seat check returns allowed', async () => {
    const seatCheck = async () => ({ allowed: true }) as const;
    const app = await buildApp(seatCheck);
    const { accessToken, tenantId } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${tenantId}/invites`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { email: 'new-seat@acme.test', role: 'org_member' },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });

  it('preserves back-compat — invites work when no seatCeilingCheck is wired', async () => {
    const app = await buildApp(undefined);
    const { accessToken, tenantId } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${tenantId}/invites`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { email: 'new-seat@acme.test', role: 'org_member' },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });

  it('routes Business+ tenants past the upsell minimum (ceiling >= 25)', async () => {
    const seatCheck = async () => ({ allowed: false, ceiling: 25, current: 25 }) as const;
    const app = await buildApp(seatCheck);
    const { accessToken, tenantId } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${tenantId}/invites`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { email: 'new-seat@acme.test', role: 'org_member' },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.upsell.minimumTier).toBe('business');
    await app.close();
  });
});
