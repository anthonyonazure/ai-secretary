/**
 * Story 14.1 — DSAR routes integration tests.
 *
 * Exercises:
 *   - POST /api/v1/dsar/requests — auth required (401 without token)
 *   - POST creates a queued row + enqueues a `dsar.export` job (202)
 *   - POST is idempotent: re-POSTing while a request is queued/processing
 *     returns 200 + the same id without enqueuing a second job
 *   - GET /api/v1/dsar/requests — returns the user's history (200)
 *   - GET /api/v1/dsar/requests/:id — returns one row (200)
 *   - GET /api/v1/dsar/requests/:id — 404 for cross-user / cross-tenant ids
 */

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
import { InMemoryDsarRepository } from './dsar-repository.js';
import { InMemoryDsarExportEnqueuer } from './dsar.js';

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
  const dsarRepo = new InMemoryDsarRepository();
  const exportEnqueuer = new InMemoryDsarExportEnqueuer();
  const refreshStore = new InMemoryRefreshTokenStore();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: authRepo,
    dsarRepository: dsarRepo,
    dsarExportEnqueuer: exportEnqueuer,
    refreshStore,
    consentChecker: async () => 'ok',
  });
  return { app, dsarRepo, exportEnqueuer };
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

describe('POST /api/v1/dsar/requests', () => {
  it('returns 401 without a bearer token', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/v1/dsar/requests' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('creates a queued request and enqueues an export job', async () => {
    const { app, dsarRepo, exportEnqueuer } = await buildApp();
    const { accessToken, userId, tenantId } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dsar/requests',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json() as {
      requestId: string;
      status: string;
      estimatedReadyAt: string;
    };
    expect(body.status).toBe('queued');
    expect(typeof body.requestId).toBe('string');
    expect(typeof body.estimatedReadyAt).toBe('string');

    expect(dsarRepo.rows).toHaveLength(1);
    expect(dsarRepo.rows[0]?.userId).toBe(userId);
    expect(dsarRepo.rows[0]?.tenantId).toBe(tenantId);

    expect(exportEnqueuer.jobs).toHaveLength(1);
    expect(exportEnqueuer.jobs[0]?.payload.requestId).toBe(body.requestId);
    expect(exportEnqueuer.jobs[0]?.payload.userId).toBe(userId);
    expect(exportEnqueuer.jobs[0]?.payload.tenantId).toBe(tenantId);
    expect(exportEnqueuer.jobs[0]?.payload.region).toBe('us');
    await app.close();
  });

  it('is idempotent — second POST returns existing request with status 200', async () => {
    const { app, dsarRepo, exportEnqueuer } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/dsar/requests',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(first.statusCode).toBe(202);
    const firstBody = first.json() as { requestId: string };

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/dsar/requests',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json() as { requestId: string };
    expect(secondBody.requestId).toBe(firstBody.requestId);

    expect(dsarRepo.rows).toHaveLength(1);
    expect(exportEnqueuer.jobs).toHaveLength(1);
    await app.close();
  });
});

describe('GET /api/v1/dsar/requests', () => {
  it('returns the authed user history', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    await app.inject({
      method: 'POST',
      url: '/api/v1/dsar/requests',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/dsar/requests',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Array<{ id: string; status: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.status).toBe('queued');
    await app.close();
  });
});

describe('GET /api/v1/dsar/requests/:id', () => {
  it('returns a single request the user owns', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/dsar/requests',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const { requestId } = created.json() as { requestId: string };

    const single = await app.inject({
      method: 'GET',
      url: `/api/v1/dsar/requests/${requestId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(single.statusCode).toBe(200);
    const body = single.json() as { id: string };
    expect(body.id).toBe(requestId);
    await app.close();
  });

  it('returns 404 for a cross-user id within the same tenant', async () => {
    const { app, dsarRepo } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app);
    const otherUserRow = await dsarRepo.create({
      tenantId,
      userId: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const single = await app.inject({
      method: 'GET',
      url: `/api/v1/dsar/requests/${otherUserRow.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(single.statusCode).toBe(404);
    await app.close();
  });

  it('returns 404 for an unknown id', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const single = await app.inject({
      method: 'GET',
      url: `/api/v1/dsar/requests/${randomUUID()}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(single.statusCode).toBe(404);
    await app.close();
  });
});
