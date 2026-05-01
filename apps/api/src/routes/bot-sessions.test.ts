import { randomUUID } from 'node:crypto';
import { InMemoryRefreshTokenStore } from '@aisecretary/auth';
import { describe, expect, it } from 'vitest';

import type { Env } from '../env.js';
import { InMemoryBotJoinEnqueuer } from '../lib/bot-join-enqueue.js';
import { buildServer } from '../server.js';
import type {
  AuthRepository,
  AuthTenantRow,
  AuthUserRow,
  CreateTenantInput,
  CreateUserInput,
} from './auth-repository.js';
import { InMemoryBotSessionsRepository } from './bot-sessions-repository.js';

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
  const botSessionsRepo = new InMemoryBotSessionsRepository();
  const enqueuer = new InMemoryBotJoinEnqueuer();
  const refreshStore = new InMemoryRefreshTokenStore();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: authRepo,
    botSessionsRepository: botSessionsRepo,
    botJoinEnqueuer: enqueuer,
    refreshStore,
    consentChecker: async () => 'ok',
  });
  return { app, botSessionsRepo, enqueuer };
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

describe('POST /api/v1/bot-sessions', () => {
  it('creates a provisioning row, enqueues a bot.join job, returns 201', async () => {
    const { app, botSessionsRepo, enqueuer } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bot-sessions',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        source: 'zoom_bot',
        externalMeetingId: '999-000-111',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('provisioning');
    expect(body.source).toBe('zoom_bot');
    expect(body.region).toBe('us');
    expect(body.externalMeetingId).toBe('999-000-111');
    expect(body.joinedAt).toBeNull();
    expect(body.endedAt).toBeNull();
    expect(typeof body.sessionId).toBe('string');
    // External passcode is write-only — never appears in the response.
    expect('externalMeetingPasscode' in body).toBe(false);

    expect(botSessionsRepo.rows).toHaveLength(1);
    expect(botSessionsRepo.rows[0]?.tenantId).toBe(tenantId);

    expect(enqueuer.jobs).toHaveLength(1);
    expect(enqueuer.jobs[0]?.payload).toMatchObject({
      sessionId: body.sessionId,
      tenantId,
      region: 'us',
    });

    await app.close();
  });

  it('accepts an optional externalMeetingPasscode without echoing it', async () => {
    const { app, botSessionsRepo } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bot-sessions',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        source: 'zoom_bot',
        externalMeetingId: '999-000-222',
        externalMeetingPasscode: 'super-secret',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect('externalMeetingPasscode' in body).toBe(false);
    // Repo got the value (write-only side).
    expect(botSessionsRepo.rows).toHaveLength(1);
    await app.close();
  });

  it('rejects an invalid source with 422', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bot-sessions',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { source: 'webex_bot', externalMeetingId: 'm-1' },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('rejects when externalMeetingId is empty', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bot-sessions',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { source: 'zoom_bot', externalMeetingId: '' },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('returns 401 without an Authorization header', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bot-sessions',
      payload: { source: 'zoom_bot', externalMeetingId: 'm-1' },
    });
    expect([401, 403]).toContain(res.statusCode);
    await app.close();
  });
});
