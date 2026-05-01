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
import { InMemoryFeedbackRepository } from './feedback-repository.js';

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

const signupBody = {
  tenantName: 'Acme Inc',
  region: 'us' as const,
  email: 'admin@acme.test',
  password: 'super-strong-password-1!',
  name: 'Admin User',
};

const buildApp = async () => {
  const authRepo = new InMemoryAuthRepository();
  const feedbackRepo = new InMemoryFeedbackRepository();
  const refreshStore = new InMemoryRefreshTokenStore();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: authRepo,
    feedbackRepository: feedbackRepo,
    refreshStore,
    consentChecker: async () => 'ok',
  });
  return { app, feedbackRepo };
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
  };
};

describe('POST /api/v1/feedback/thumbs', () => {
  it('records a thumbs-up response', async () => {
    const { app, feedbackRepo } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const meetingId = randomUUID();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback/thumbs',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { meetingId, response: 'up', context: 'first-three' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.meetingId).toBe(meetingId);
    expect(body.response).toBe('up');
    expect(body.context).toBe('first-three');
    expect(typeof body.id).toBe('string');
    expect(typeof body.createdAt).toBe('string');
    expect(feedbackRepo.rows).toHaveLength(1);
    await app.close();
  });

  it('records a thumbs-down response without context', async () => {
    const { app, feedbackRepo } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const meetingId = randomUUID();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback/thumbs',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { meetingId, response: 'down' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.response).toBe('down');
    expect(body.context).toBeNull();
    expect(feedbackRepo.rows).toHaveLength(1);
    await app.close();
  });

  it('returns 409 on duplicate (same user + meeting)', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const meetingId = randomUUID();

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback/thumbs',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { meetingId, response: 'up' },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback/thumbs',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { meetingId, response: 'down' },
    });
    expect(second.statusCode).toBe(409);
    await app.close();
  });

  it('returns 422 on invalid response value', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback/thumbs',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { meetingId: randomUUID(), response: 'maybe' },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/feedback/thumbs',
      payload: { meetingId: randomUUID(), response: 'up' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
