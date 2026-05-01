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
import { InMemoryErasurePreviewRepository } from './erasure-preview-repository.js';

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
  const erasurePreviewRepo = new InMemoryErasurePreviewRepository();
  const refreshStore = new InMemoryRefreshTokenStore();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: authRepo,
    erasurePreviewRepository: erasurePreviewRepo,
    refreshStore,
    consentChecker: async () => 'ok',
  });
  return { app, erasurePreviewRepo };
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

describe('GET /api/v1/erasure-preview/:userId', () => {
  it('returns the cascade-scope preview with seeded counts', async () => {
    const { app, erasurePreviewRepo } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    erasurePreviewRepo.counts.meetings = 47;
    erasurePreviewRepo.counts.action_items = 12;
    erasurePreviewRepo.counts.audit_logs = 3;
    erasurePreviewRepo.counts.notifications = 5;
    erasurePreviewRepo.counts.feedback_thumbs = 11;

    const targetUser = randomUUID();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/erasure-preview/${targetUser}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scope.userId).toBe(targetUser);
    expect(body.fullyHandled).toBe(true);
    // 47 + 12 + 3 + 5 + 11 = 78. The `users` row count is not seeded
    // (defaults to 0), so total stays at 78.
    expect(body.totalRowsAffected).toBe(78);
    expect(body.stages.length).toBeGreaterThan(0);
    const meetingsStage = body.stages.find((s: { table: string }) => s.table === 'meetings');
    expect(meetingsStage.rowCount).toBe(47);
    expect(meetingsStage.action).toBe('shred');
    await app.close();
  });

  it('marks cascade-source rows as cascade-source-skipped (rowCount 0)', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/erasure-preview/${randomUUID()}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = res.json();
    const tenants = body.stages.find((s: { table: string }) => s.table === 'tenants');
    expect(tenants.action).toBe('cascade-source-skipped');
    expect(tenants.rowCount).toBe(0);
    await app.close();
  });

  it('classifies module_outputs / speaker_turns / recordings as cascade-fk', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/erasure-preview/${randomUUID()}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = res.json();
    const tables = ['module_outputs', 'speaker_turns', 'recordings', 'consents'];
    for (const t of tables) {
      const stage = body.stages.find((s: { table: string }) => s.table === t);
      expect(stage.action).toBe('cascade-fk');
    }
    await app.close();
  });

  it('returns 422 for an invalid userId', async () => {
    const { app } = await buildApp();
    const { accessToken } = await signupAndAuth(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/erasure-preview/not-a-uuid',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/erasure-preview/${randomUUID()}`,
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
