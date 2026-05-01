/**
 * Story 1.5d — invites routes integration tests.
 *
 * Exercises:
 *   - admin POST /tenants/:tenantId/invites      → 201 + email enqueued
 *   - non-admin POST                             → 403
 *   - admin GET /tenants/:tenantId/invites       → list
 *   - admin DELETE /tenants/:tenantId/invites/:id → 204 + revoked
 *   - public GET /invites/:token                 → 200 lookup metadata
 *   - public POST /invites/:token/accept happy   → 201 session pair
 *   - accept with expired token                  → 410 Gone
 *   - accept with already-accepted token         → 409 Conflict
 *   - accept with revoked token                  → 410 Gone
 */

import { createHash, randomBytes } from 'node:crypto';
import { InMemoryRefreshTokenStore } from '@aisecretary/auth';
import { describe, expect, it } from 'vitest';
import type { Env } from '../env.js';
import { buildServer } from '../server.js';
import type { AuthRepository } from './auth-repository.js';
import { InMemoryInvitesRepository } from './invites-repository.js';
import {
  InMemoryInviteNotificationEnqueuer,
  type InviteNotificationJobPayload,
} from './invites.js';

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  HOST: '0.0.0.0',
  REGION: 'us',
  DATABASE_URL: 'postgres://localhost:5432/aisecretary_test',
  JWT_SECRET: 'test-secret-must-be-at-least-32-chars-long-please',
  LOG_LEVEL: 'error',
};

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_USER_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_USER_ID = '33333333-3333-4333-8333-333333333333';

const signupBody = {
  tenantName: 'Acme Inc',
  region: 'us' as const,
  email: 'admin@acme.test',
  password: 'super-strong-password-1!',
  name: 'Admin User',
};

class StubAuthRepository implements AuthRepository {
  public readonly users = new Map<
    string,
    {
      id: string;
      tenantId: string;
      email: string;
      name: string;
      role: 'super_admin' | 'org_admin' | 'org_member' | 'org_viewer';
      passwordHash: string | null;
      isMfaEnabled: boolean;
    }
  >();
  public readonly tenants = new Map<
    string,
    { id: string; name: string; slug: string; region: 'us' | 'eu' }
  >();

  async findUserByEmail(email: string) {
    for (const u of this.users.values()) {
      if (u.email === email.toLowerCase()) return u;
    }
    return null;
  }

  async findUserById(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async findTenantById(tenantId: string) {
    return this.tenants.get(tenantId) ?? null;
  }

  async createTenant(input: { name: string; slug: string; region: 'us' | 'eu' }) {
    const row = {
      id: TENANT_ID,
      name: input.name,
      slug: input.slug,
      region: input.region,
    };
    this.tenants.set(row.id, row);
    return row;
  }

  async createUser(input: {
    tenantId: string;
    email: string;
    name: string;
    role: 'super_admin' | 'org_admin' | 'org_member' | 'org_viewer';
    passwordHash: string;
  }) {
    const id = this.users.size === 0 ? ADMIN_USER_ID : MEMBER_USER_ID;
    const row = {
      id,
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

  async touchLastLogin(): Promise<void> {
    /* no-op */
  }
}

const buildTestApp = async () => {
  const authRepo = new StubAuthRepository();
  const invitesRepo = new InMemoryInvitesRepository();
  const refreshStore = new InMemoryRefreshTokenStore();
  const inviteEnqueuer = new InMemoryInviteNotificationEnqueuer();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: authRepo,
    invitesRepository: invitesRepo,
    refreshStore,
    inviteNotificationEnqueuer: inviteEnqueuer,
    inviteAppBaseUrl: 'https://app.aisecretary.test',
    consentChecker: async () => 'ok',
  });
  return { app, authRepo, invitesRepo, refreshStore, inviteEnqueuer };
};

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

interface SignupResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; tenantId: string };
}

const signupAdmin = async (app: Awaited<ReturnType<typeof buildTestApp>>['app']) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: signupBody,
  });
  expect(res.statusCode).toBe(201);
  return res.json() as SignupResult;
};

const seedJoinFixtures = (ctx: Awaited<ReturnType<typeof buildTestApp>>, signup: SignupResult) => {
  ctx.invitesRepo.seedTenant({
    id: signup.user.tenantId,
    name: signupBody.tenantName,
    region: 'us',
  });
  ctx.invitesRepo.seedUser({
    id: signup.user.id,
    name: signupBody.name,
    email: signupBody.email,
    tenantId: signup.user.tenantId,
  });
};

describe('invites routes — admin flow', () => {
  it('admin can create an invite, email is enqueued', async () => {
    const ctx = await buildTestApp();
    const signup = await signupAdmin(ctx.app);
    seedJoinFixtures(ctx, signup);

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${signup.user.tenantId}/invites`,
      headers: { authorization: `Bearer ${signup.accessToken}` },
      payload: { email: 'newmember@acme.test', role: 'org_member' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      id: string;
      email: string;
      role: string;
      acceptedAt: string | null;
      revokedAt: string | null;
    };
    expect(body.email).toBe('newmember@acme.test');
    expect(body.role).toBe('org_member');
    expect(body.acceptedAt).toBeNull();
    expect(body.revokedAt).toBeNull();
    expect(ctx.invitesRepo.invites).toHaveLength(1);
    expect(ctx.inviteEnqueuer.jobs).toHaveLength(1);
    const job = ctx.inviteEnqueuer.jobs[0]?.payload as InviteNotificationJobPayload;
    expect(job.kind).toBe('tenant-invite');
    expect(job.recipient.email).toBe('newmember@acme.test');
    expect(typeof job.payload.context.acceptUrl).toBe('string');
    expect(
      (job.payload.context.acceptUrl as string).startsWith('https://app.aisecretary.test'),
    ).toBe(true);
    await ctx.app.close();
  });

  it('org_admin from one tenant cannot create invites in another tenant (403)', async () => {
    const ctx = await buildTestApp();
    const signup = await signupAdmin(ctx.app);
    seedJoinFixtures(ctx, signup);

    const otherTenant = '99999999-9999-4999-8999-999999999999';
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${otherTenant}/invites`,
      headers: { authorization: `Bearer ${signup.accessToken}` },
      payload: { email: 'x@y.test', role: 'org_member' },
    });
    // org_admin's tenant claim doesn't match the path tenant; expect
    // 403 from assertTenantPathMatchesUser. (super_admin is the only
    // role allowed to act cross-tenant.)
    expect(res.statusCode).toBe(403);
    await ctx.app.close();
  });

  it('non-admin POST returns 403', async () => {
    const ctx = await buildTestApp();
    const signup = await signupAdmin(ctx.app);
    // Demote the admin to org_member to simulate a non-admin caller.
    const u = ctx.authRepo.users.get(signup.user.id);
    if (u) {
      ctx.authRepo.users.set(signup.user.id, { ...u, role: 'org_member' });
    }
    seedJoinFixtures(ctx, signup);

    // Re-login to mint a JWT carrying the new role.
    const loginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: signupBody.email, password: signupBody.password },
    });
    const loginBody = loginRes.json() as SignupResult;

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${signup.user.tenantId}/invites`,
      headers: { authorization: `Bearer ${loginBody.accessToken}` },
      payload: { email: 'newmember@acme.test', role: 'org_member' },
    });
    expect(res.statusCode).toBe(403);
    await ctx.app.close();
  });

  it('admin can list invites with totalCount + inviter join', async () => {
    const ctx = await buildTestApp();
    const signup = await signupAdmin(ctx.app);
    seedJoinFixtures(ctx, signup);

    await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${signup.user.tenantId}/invites`,
      headers: { authorization: `Bearer ${signup.accessToken}` },
      payload: { email: 'a@acme.test', role: 'org_member' },
    });
    await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${signup.user.tenantId}/invites`,
      headers: { authorization: `Bearer ${signup.accessToken}` },
      payload: { email: 'b@acme.test', role: 'org_viewer' },
    });

    const list = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/tenants/${signup.user.tenantId}/invites`,
      headers: { authorization: `Bearer ${signup.accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as {
      items: Array<{ email: string; invitedBy: { name: string } }>;
      totalCount: number;
    };
    expect(body.totalCount).toBe(2);
    expect(body.items).toHaveLength(2);
    for (const item of body.items) {
      expect(item.invitedBy.name).toBe(signupBody.name);
    }
    await ctx.app.close();
  });

  it('admin can revoke an invite', async () => {
    const ctx = await buildTestApp();
    const signup = await signupAdmin(ctx.app);
    seedJoinFixtures(ctx, signup);

    const created = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${signup.user.tenantId}/invites`,
      headers: { authorization: `Bearer ${signup.accessToken}` },
      payload: { email: 'c@acme.test', role: 'org_member' },
    });
    const createdBody = created.json() as { id: string };
    const revokeRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/tenants/${signup.user.tenantId}/invites/${createdBody.id}`,
      headers: { authorization: `Bearer ${signup.accessToken}` },
    });
    expect(revokeRes.statusCode).toBe(204);
    expect(ctx.invitesRepo.invites[0]?.revokedAt).not.toBeNull();
    await ctx.app.close();
  });

  it('returns 409 when re-inviting an open recipient', async () => {
    const ctx = await buildTestApp();
    const signup = await signupAdmin(ctx.app);
    seedJoinFixtures(ctx, signup);

    const first = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${signup.user.tenantId}/invites`,
      headers: { authorization: `Bearer ${signup.accessToken}` },
      payload: { email: 'dup@acme.test', role: 'org_member' },
    });
    expect(first.statusCode).toBe(201);

    const second = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/tenants/${signup.user.tenantId}/invites`,
      headers: { authorization: `Bearer ${signup.accessToken}` },
      payload: { email: 'dup@acme.test', role: 'org_member' },
    });
    expect(second.statusCode).toBe(409);
    await ctx.app.close();
  });
});

describe('invites routes — public flow', () => {
  it('GET /invites/:token returns lookup metadata for a fresh invite', async () => {
    const ctx = await buildTestApp();
    const signup = await signupAdmin(ctx.app);
    seedJoinFixtures(ctx, signup);

    // Inject the invite directly into the repo so we control the
    // plaintext token (the route hashes whatever it generates and
    // dispatches via email — tests don't have visibility into the
    // dispatched plaintext, but we can inject one via repo.create).
    const plaintext = randomBytes(32).toString('base64url');
    await ctx.invitesRepo.create({
      tenantId: signup.user.tenantId,
      invitedByUserId: signup.user.id,
      email: 'newby@acme.test',
      role: 'org_member',
      tokenHash: sha256Hex(plaintext),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/invites/${plaintext}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      email: string;
      tenantName: string;
      inviterName: string;
      role: string;
    };
    expect(body.email).toBe('newby@acme.test');
    expect(body.tenantName).toBe(signupBody.tenantName);
    expect(body.inviterName).toBe(signupBody.name);
    expect(body.role).toBe('org_member');
    await ctx.app.close();
  });

  it('GET /invites/:token returns 404 for unknown token', async () => {
    const ctx = await buildTestApp();
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/invites/no-such-token',
    });
    expect(res.statusCode).toBe(404);
    await ctx.app.close();
  });

  it('POST /invites/:token/accept happy path mints a session', async () => {
    const ctx = await buildTestApp();
    const signup = await signupAdmin(ctx.app);
    seedJoinFixtures(ctx, signup);

    const plaintext = randomBytes(32).toString('base64url');
    await ctx.invitesRepo.create({
      tenantId: signup.user.tenantId,
      invitedByUserId: signup.user.id,
      email: 'accepter@acme.test',
      role: 'org_member',
      tokenHash: sha256Hex(plaintext),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/invites/${plaintext}/accept`,
      payload: {
        token: plaintext,
        password: 'long-enough-password-1!',
        name: 'New Member',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; role: string; tenantId: string };
    };
    expect(body.accessToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.user.email).toBe('accepter@acme.test');
    expect(body.user.role).toBe('org_member');
    expect(body.user.tenantId).toBe(signup.user.tenantId);
    expect(ctx.invitesRepo.invites[0]?.acceptedAt).not.toBeNull();
    await ctx.app.close();
  });

  it('POST /invites/:token/accept returns 410 for expired token', async () => {
    const ctx = await buildTestApp();
    const signup = await signupAdmin(ctx.app);
    seedJoinFixtures(ctx, signup);

    const plaintext = randomBytes(32).toString('base64url');
    await ctx.invitesRepo.create({
      tenantId: signup.user.tenantId,
      invitedByUserId: signup.user.id,
      email: 'expired@acme.test',
      role: 'org_member',
      tokenHash: sha256Hex(plaintext),
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/invites/${plaintext}/accept`,
      payload: {
        token: plaintext,
        password: 'long-enough-password-1!',
        name: 'Expired Try',
      },
    });
    expect(res.statusCode).toBe(410);
    await ctx.app.close();
  });

  it('POST /invites/:token/accept returns 409 when already accepted', async () => {
    const ctx = await buildTestApp();
    const signup = await signupAdmin(ctx.app);
    seedJoinFixtures(ctx, signup);

    const plaintext = randomBytes(32).toString('base64url');
    const created = await ctx.invitesRepo.create({
      tenantId: signup.user.tenantId,
      invitedByUserId: signup.user.id,
      email: 'twice@acme.test',
      role: 'org_member',
      tokenHash: sha256Hex(plaintext),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    // Mark accepted out-of-band.
    const idx = ctx.invitesRepo.invites.findIndex((r) => r.id === created.id);
    if (idx >= 0) {
      const existing = ctx.invitesRepo.invites[idx];
      if (existing) {
        ctx.invitesRepo.invites[idx] = {
          ...existing,
          acceptedAt: new Date(),
          acceptedByUserId: '00000000-0000-4000-8000-000000000000',
        };
      }
    }

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/invites/${plaintext}/accept`,
      payload: {
        token: plaintext,
        password: 'long-enough-password-1!',
        name: 'Twice Tried',
      },
    });
    expect(res.statusCode).toBe(409);
    await ctx.app.close();
  });

  it('POST /invites/:token/accept returns 410 when revoked', async () => {
    const ctx = await buildTestApp();
    const signup = await signupAdmin(ctx.app);
    seedJoinFixtures(ctx, signup);

    const plaintext = randomBytes(32).toString('base64url');
    const created = await ctx.invitesRepo.create({
      tenantId: signup.user.tenantId,
      invitedByUserId: signup.user.id,
      email: 'revoked@acme.test',
      role: 'org_member',
      tokenHash: sha256Hex(plaintext),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await ctx.invitesRepo.revoke(created.id, signup.user.tenantId, signup.user.id);

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/invites/${plaintext}/accept`,
      payload: {
        token: plaintext,
        password: 'long-enough-password-1!',
        name: 'Revoked Try',
      },
    });
    expect(res.statusCode).toBe(410);
    await ctx.app.close();
  });

  it('POST /invites/:token/accept rejects short password with 422', async () => {
    const ctx = await buildTestApp();
    const signup = await signupAdmin(ctx.app);
    seedJoinFixtures(ctx, signup);

    const plaintext = randomBytes(32).toString('base64url');
    await ctx.invitesRepo.create({
      tenantId: signup.user.tenantId,
      invitedByUserId: signup.user.id,
      email: 'shortpw@acme.test',
      role: 'org_member',
      tokenHash: sha256Hex(plaintext),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/invites/${plaintext}/accept`,
      payload: { token: plaintext, password: 'short', name: 'X' },
    });
    expect(res.statusCode).toBe(422);
    await ctx.app.close();
  });
});
