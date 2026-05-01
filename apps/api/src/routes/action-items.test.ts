import { randomUUID } from 'node:crypto';
import { InMemoryRefreshTokenStore } from '@aisecretary/auth';
import { describe, expect, it } from 'vitest';
import type { Env } from '../env.js';
import { buildServer } from '../server.js';
import {
  type ActionItemListRow,
  InMemoryActionItemsRepository,
} from './action-items-repository.js';
import type {
  AuthRepository,
  AuthTenantRow,
  AuthUserRow,
  CreateTenantInput,
  CreateUserInput,
} from './auth-repository.js';

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
  const actionItemsRepo = new InMemoryActionItemsRepository();
  const refreshStore = new InMemoryRefreshTokenStore();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: authRepo,
    actionItemsRepository: actionItemsRepo,
    refreshStore,
    consentChecker: async () => 'ok',
  });
  return { app, actionItemsRepo };
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

const seedRow = (overrides: Partial<ActionItemListRow> = {}): ActionItemListRow => {
  const meetingId = overrides.meetingId ?? randomUUID();
  const now = new Date();
  return {
    id: overrides.id ?? randomUUID(),
    meetingId,
    meetingTitle: overrides.meetingTitle ?? 'Weekly sales sync',
    meetingRecordedAt: overrides.meetingRecordedAt ?? now,
    text: overrides.text ?? 'Send the SOC 2 questionnaire to Acme.',
    ownerName: overrides.ownerName ?? 'Anthony',
    ownerUserId: overrides.ownerUserId ?? null,
    dueDate: overrides.dueDate ?? null,
    status: overrides.status ?? 'pending',
    confidence: overrides.confidence ?? 0.85,
    citations: overrides.citations ?? [
      {
        meetingId,
        turnId: 'turn-abc',
        spanStartMs: 12000,
        spanEndMs: 14500,
      },
    ],
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
};

describe('GET /api/v1/action-items', () => {
  it('returns the cross-meeting list with default pending+accepted filter', async () => {
    const { app, actionItemsRepo } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app);

    const a = seedRow({ status: 'pending', text: 'A pending item' });
    const b = seedRow({ status: 'done', text: 'A done item' });
    const c = seedRow({ status: 'accepted', text: 'An accepted item' });
    actionItemsRepo.insert(tenantId, a);
    actionItemsRepo.insert(tenantId, b);
    actionItemsRepo.insert(tenantId, c);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/action-items?status=pending,accepted',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const texts = body.items.map((i: { text: string }) => i.text).sort();
    expect(texts).toEqual(['A pending item', 'An accepted item']);
    expect(body.totalCount).toBe(3);
    await app.close();
  });

  it('filters by source meeting', async () => {
    const { app, actionItemsRepo } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app);
    const meetingA = randomUUID();
    const meetingB = randomUUID();
    actionItemsRepo.insert(tenantId, seedRow({ meetingId: meetingA, text: 'A1' }));
    actionItemsRepo.insert(tenantId, seedRow({ meetingId: meetingA, text: 'A2' }));
    actionItemsRepo.insert(tenantId, seedRow({ meetingId: meetingB, text: 'B1' }));

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/action-items?meetingId=${meetingA}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const texts = res
      .json()
      .items.map((i: { text: string }) => i.text)
      .sort();
    expect(texts).toEqual(['A1', 'A2']);
    await app.close();
  });

  it('filters by dueBefore', async () => {
    const { app, actionItemsRepo } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app);
    const past = new Date('2026-04-01T00:00:00Z');
    const future = new Date('2026-12-01T00:00:00Z');
    actionItemsRepo.insert(tenantId, seedRow({ dueDate: past, text: 'Overdue' }));
    actionItemsRepo.insert(tenantId, seedRow({ dueDate: future, text: 'Later' }));
    actionItemsRepo.insert(tenantId, seedRow({ dueDate: null, text: 'No date' }));

    const cutoff = '2026-05-01T00:00:00.000Z';
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/action-items?dueBefore=${encodeURIComponent(cutoff)}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const texts = res.json().items.map((i: { text: string }) => i.text);
    expect(texts).toEqual(['Overdue']);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/action-items' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('PATCH /api/v1/action-items/:id', () => {
  it('marks an action item done', async () => {
    const { app, actionItemsRepo } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app);
    const row = seedRow({ status: 'pending' });
    actionItemsRepo.insert(tenantId, row);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/action-items/${row.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: 'done' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('done');
    await app.close();
  });

  it('returns 404 for an unknown id', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/action-items/${randomUUID()}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: 'done' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('returns 422 for an invalid status', async () => {
    const { app, actionItemsRepo } = await buildApp();
    const { accessToken, tenantId } = await signupAndAuth(app);
    const row = seedRow();
    actionItemsRepo.insert(tenantId, row);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/action-items/${row.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: 'frozen' },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('does not return rows from another tenant', async () => {
    const { app, actionItemsRepo } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const otherTenant = randomUUID();
    const row = seedRow();
    actionItemsRepo.insert(otherTenant, row);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/action-items/${row.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: 'done' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
