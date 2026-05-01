import { randomUUID } from 'node:crypto';
import { InMemoryRefreshTokenStore } from '@aisecretary/auth';
import { authenticator } from 'otplib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../env.js';
import { buildServer } from '../server.js';
import type {
  AuthRepository,
  AuthTenantRow,
  AuthUserRow,
  CreateTenantInput,
  CreateUserInput,
  MfaEnrollmentInput,
  UserMfaState,
} from './auth-repository.js';
import { __resetMfaCountersForTests } from './auth.js';

const TEST_MFA_KEY = 'a'.repeat(64);

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  HOST: '0.0.0.0',
  REGION: 'us',
  DATABASE_URL: 'postgres://localhost:5432/aisecretary_test',
  JWT_SECRET: 'test-secret-must-be-at-least-32-chars-long-please',
  JWT_MFA_CHALLENGE_SECRET: 'test-mfa-challenge-secret-32-chars-min-please',
  MFA_SECRET_ENCRYPTION_KEY: TEST_MFA_KEY,
  LOG_LEVEL: 'error',
};

interface MfaInternals {
  mfaPending: boolean;
  mfaSecretEncrypted: string | null;
  recoveryCodeHashes: string[];
}

class InMemoryAuthRepository implements AuthRepository {
  public readonly users = new Map<string, AuthUserRow>();
  public readonly tenants = new Map<string, AuthTenantRow>();
  public readonly mfa = new Map<string, MfaInternals>();

  async findUserByEmail(email: string): Promise<AuthUserRow | null> {
    for (const u of this.users.values()) {
      if (u.email === email.toLowerCase()) return u;
    }
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
      mfaRequired: false,
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
    this.mfa.set(row.id, {
      mfaPending: false,
      mfaSecretEncrypted: null,
      recoveryCodeHashes: [],
    });
    return row;
  }

  async touchLastLogin(): Promise<void> {
    // no-op for tests
  }

  async findUserByIdForMfa(userId: string, tenantId: string): Promise<UserMfaState | null> {
    const user = this.users.get(userId);
    if (!user || user.tenantId !== tenantId) return null;
    const mfa = this.mfa.get(userId) ?? {
      mfaPending: false,
      mfaSecretEncrypted: null,
      recoveryCodeHashes: [],
    };
    const tenant = this.tenants.get(tenantId);
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      region: tenant?.region ?? 'us',
      passwordHash: user.passwordHash,
      isMfaEnabled: user.isMfaEnabled,
      mfaPending: mfa.mfaPending,
      mfaSecretEncrypted: mfa.mfaSecretEncrypted,
      recoveryCodeHashes: mfa.recoveryCodeHashes,
    };
  }

  async setMfaEnrollment(
    userId: string,
    _tenantId: string,
    input: MfaEnrollmentInput,
  ): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.isMfaEnabled = false;
    this.mfa.set(userId, {
      mfaPending: true,
      mfaSecretEncrypted: input.encryptedSecret,
      recoveryCodeHashes: [...input.recoveryCodeHashes],
    });
  }

  async confirmMfaEnrollment(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.isMfaEnabled = true;
    const mfa = this.mfa.get(userId);
    if (mfa) mfa.mfaPending = false;
  }

  async disableMfa(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.isMfaEnabled = false;
    this.mfa.set(userId, {
      mfaPending: false,
      mfaSecretEncrypted: null,
      recoveryCodeHashes: [],
    });
  }

  async consumeRecoveryCode(userId: string, _tenantId: string, codeHash: string): Promise<boolean> {
    const mfa = this.mfa.get(userId);
    if (!mfa) return false;
    const idx = mfa.recoveryCodeHashes.indexOf(codeHash);
    if (idx === -1) return false;
    mfa.recoveryCodeHashes.splice(idx, 1);
    return true;
  }
}

const buildTestApp = async () => {
  const repo = new InMemoryAuthRepository();
  const refreshStore = new InMemoryRefreshTokenStore();
  const app = await buildServer({
    env: TEST_ENV,
    authRepository: repo,
    refreshStore,
    consentChecker: async () => 'ok',
  });
  return { app, repo, refreshStore };
};

const signupBody = {
  tenantName: 'Acme Inc',
  region: 'us' as const,
  email: 'admin@acme.test',
  password: 'super-strong-password-1!',
  name: 'Admin User',
};

beforeEach(() => __resetMfaCountersForTests());
afterEach(() => __resetMfaCountersForTests());

describe('auth routes', () => {
  it('POST /signup creates tenant + user and issues a JWT pair', async () => {
    const { app, repo, refreshStore } = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.expiresIn).toBe(15 * 60);
    expect(body.user.email).toBe(signupBody.email);
    expect(body.user.name).toBe(signupBody.name);
    expect(body.user.role).toBe('org_admin');
    expect(body.user.region).toBe('us');
    expect(repo.tenants.size).toBe(1);
    expect(repo.users.size).toBe(1);
    // Refresh token persisted.
    const stored = await refreshStore.lookup(body.refreshToken);
    expect(stored).not.toBeNull();
    await app.close();
  });

  it('POST /signup returns 409 on duplicate email', async () => {
    const { app } = await buildTestApp();
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { ...signupBody, tenantName: 'Acme Two' },
    });
    expect(second.statusCode).toBe(409);
    await app.close();
  });

  it('POST /signup returns 422 for invalid payload', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { ...signupBody, password: 'short' },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('POST /login accepts correct credentials and returns kind=session', async () => {
    const { app } = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: signupBody.email, password: signupBody.password },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.kind).toBe('session');
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.email).toBe(signupBody.email);
    await app.close();
  });

  it('POST /login rejects wrong password with 401', async () => {
    const { app } = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: signupBody.email, password: 'wrong-password!' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('POST /login rejects unknown email with 401', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'nobody@example.com', password: 'whatever-password-1' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('GET /me returns the authenticated user', async () => {
    const { app } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { accessToken, user } = signupRes.json();
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(meRes.statusCode).toBe(200);
    const me = meRes.json();
    expect(me.user.id).toBe(user.id);
    expect(me.user.email).toBe(user.email);
    expect(me.user.tenantId).toBe(user.tenantId);
    expect(me.user.region).toBe('us');
    await app.close();
  });

  it('GET /me returns 401 without a token', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('POST /refresh rotates the token', async () => {
    const { app, refreshStore } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { refreshToken: oldToken } = signupRes.json();
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: oldToken },
    });
    expect(refreshRes.statusCode).toBe(200);
    const body = refreshRes.json();
    expect(body.refreshToken).not.toBe(oldToken);
    expect(body.accessToken).toBeTruthy();
    expect(body.user.email).toBe(signupBody.email);
    // Old token revoked.
    expect(await refreshStore.lookup(oldToken)).toBeNull();
    expect(await refreshStore.lookup(body.refreshToken)).not.toBeNull();
    await app.close();
  });

  it('POST /refresh with the old token after rotation fails with 401', async () => {
    const { app } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { refreshToken: oldToken } = signupRes.json();
    const firstRefresh = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: oldToken },
    });
    expect(firstRefresh.statusCode).toBe(200);

    // Replay attack: try the old token again.
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: oldToken },
    });
    expect(replay.statusCode).toBe(401);
    await app.close();
  });

  it('POST /refresh returns 401 for unknown token', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'no-such-token-here' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('POST /logout revokes the refresh token', async () => {
    const { app } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { refreshToken } = signupRes.json();
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken },
    });
    expect(logoutRes.statusCode).toBe(204);
    // Subsequent refresh fails.
    const followUp = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(followUp.statusCode).toBe(401);
    await app.close();
  });

  /* ------------------------------------------------------------------ */
  /* Story 1.5e — httpOnly refresh-cookie tests.                         */
  /* ------------------------------------------------------------------ */

  it('POST /signup sets the aisecretary_refresh httpOnly cookie', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    expect(res.statusCode).toBe(201);
    const setCookie = res.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
    const refreshCookie = cookies.find((c) => c?.startsWith('aisecretary_refresh='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('SameSite=Lax');
    expect(refreshCookie).toContain('Path=/api/v1/auth');
    // Non-production test config — `secure` flag should be ABSENT.
    expect(refreshCookie).not.toContain('Secure');
    await app.close();
  });

  it('POST /refresh accepts the refresh token via cookie (no body)', async () => {
    const { app } = await buildTestApp();
    const signup = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { refreshToken } = signup.json();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `aisecretary_refresh=${refreshToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.refreshToken).not.toBe(refreshToken);
    expect(body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await app.close();
  });

  it('POST /refresh with no cookie or body returns 401', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('POST /logout clears the refresh cookie and revokes via either source', async () => {
    const { app, refreshStore } = await buildTestApp();
    const signup = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { refreshToken } = signup.json();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie: `aisecretary_refresh=${refreshToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(204);
    const setCookie = res.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
    const cleared = cookies.find((c) => c?.startsWith('aisecretary_refresh='));
    expect(cleared).toBeDefined();
    // Cleared cookie sets either an empty value or an expired Max-Age.
    expect(cleared).toMatch(/aisecretary_refresh=;|Max-Age=0|Expires=Thu, 01 Jan 1970/);
    expect(await refreshStore.lookup(refreshToken)).toBeNull();
    await app.close();
  });
});

/* -------------------------------------------------------------------------- */
/* Story 1.5c — MFA flow tests.                                                */
/* -------------------------------------------------------------------------- */

const enrollAndConfirm = async (
  app: Awaited<ReturnType<typeof buildTestApp>>['app'],
  accessToken: string,
): Promise<{ secret: string; recoveryCodes: string[] }> => {
  const enrollRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/mfa/enroll',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  expect(enrollRes.statusCode).toBe(200);
  const { secret, recoveryCodes } = enrollRes.json();
  const code = authenticator.generate(secret);
  const confirmRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/mfa/confirm',
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { code },
  });
  expect(confirmRes.statusCode).toBe(204);
  return { secret, recoveryCodes };
};

describe('auth MFA routes (Story 1.5c)', () => {
  it('login with MFA enrolled returns kind=mfa-required', async () => {
    const { app } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { accessToken } = signupRes.json();
    await enrollAndConfirm(app, accessToken);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: signupBody.email, password: signupBody.password },
    });
    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    expect(body.kind).toBe('mfa-required');
    expect(body.challengeToken).toBeTruthy();
    expect(body.enrollmentRequired).toBe(false);
    expect(typeof body.expiresAt).toBe('string');
    await app.close();
  });

  it('verify-mfa with a valid TOTP issues a session', async () => {
    const { app } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { accessToken } = signupRes.json();
    const { secret } = await enrollAndConfirm(app, accessToken);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: signupBody.email, password: signupBody.password },
    });
    const { challengeToken } = loginRes.json();

    const code = authenticator.generate(secret);
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login/verify-mfa',
      payload: { challengeToken, code },
    });
    expect(verifyRes.statusCode).toBe(200);
    const body = verifyRes.json();
    expect(body.kind).toBe('session');
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    await app.close();
  });

  it('verify-mfa with a wrong TOTP fails 401 and increments the counter', async () => {
    const { app } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { accessToken } = signupRes.json();
    await enrollAndConfirm(app, accessToken);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: signupBody.email, password: signupBody.password },
    });
    const { challengeToken } = loginRes.json();
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login/verify-mfa',
      payload: { challengeToken, code: '000000' },
    });
    expect(verifyRes.statusCode).toBe(401);
    await app.close();
  });

  it('verify-mfa with a recovery code consumes it (single-use)', async () => {
    const { app } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { accessToken } = signupRes.json();
    const { recoveryCodes } = await enrollAndConfirm(app, accessToken);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: signupBody.email, password: signupBody.password },
    });
    const { challengeToken } = loginRes.json();

    const code = recoveryCodes[0];
    const firstUse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login/verify-mfa',
      payload: { challengeToken, code },
    });
    expect(firstUse.statusCode).toBe(200);
    expect(firstUse.json().kind).toBe('session');

    // Re-login + try the same recovery code again.
    const login2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: signupBody.email, password: signupBody.password },
    });
    const reuse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login/verify-mfa',
      payload: { challengeToken: login2.json().challengeToken, code },
    });
    expect(reuse.statusCode).toBe(401);
    await app.close();
  });

  it('locks the user out after 5 failed MFA attempts', async () => {
    const { app } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { accessToken } = signupRes.json();
    await enrollAndConfirm(app, accessToken);

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: signupBody.email, password: signupBody.password },
    });
    const { challengeToken } = login.json();

    for (let i = 0; i < 4; i += 1) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login/verify-mfa',
        payload: { challengeToken, code: '000000' },
      });
      expect(r.statusCode).toBe(401);
    }
    const fifth = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login/verify-mfa',
      payload: { challengeToken, code: '000000' },
    });
    expect(fifth.statusCode).toBe(429);
    await app.close();
  });

  it('enroll → confirm cycle flips is_mfa_enabled', async () => {
    const { app, repo } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { accessToken, user } = signupRes.json();
    expect(repo.users.get(user.id)?.isMfaEnabled).toBe(false);
    await enrollAndConfirm(app, accessToken);
    expect(repo.users.get(user.id)?.isMfaEnabled).toBe(true);
    await app.close();
  });

  it('confirm with wrong code fails 401 and leaves is_mfa_enabled=false', async () => {
    const { app, repo } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { accessToken, user } = signupRes.json();
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/enroll',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const confirmRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/confirm',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: '000000' },
    });
    expect(confirmRes.statusCode).toBe(401);
    expect(repo.users.get(user.id)?.isMfaEnabled).toBe(false);
    await app.close();
  });

  it('disable requires both password + TOTP', async () => {
    const { app, repo } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { accessToken, user } = signupRes.json();
    const { secret } = await enrollAndConfirm(app, accessToken);

    // Wrong password.
    const wrongPw = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/disable',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { password: 'nope-not-the-password', code: authenticator.generate(secret) },
    });
    expect(wrongPw.statusCode).toBe(401);

    // Right password + right TOTP.
    const ok = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/disable',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { password: signupBody.password, code: authenticator.generate(secret) },
    });
    expect(ok.statusCode).toBe(204);
    expect(repo.users.get(user.id)?.isMfaEnabled).toBe(false);
    await app.close();
  });

  it('regenerate recovery codes returns 10 fresh codes and revokes refresh tokens', async () => {
    const { app, refreshStore } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { accessToken, refreshToken } = signupRes.json();
    const { secret, recoveryCodes } = await enrollAndConfirm(app, accessToken);

    expect(await refreshStore.lookup(refreshToken)).not.toBeNull();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/recovery-codes/regenerate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { password: signupBody.password, code: authenticator.generate(secret) },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.recoveryCodes).toHaveLength(10);
    // Codes are different from the originals.
    for (const c of body.recoveryCodes) {
      expect(recoveryCodes).not.toContain(c);
    }
    // Refresh token revoked.
    expect(await refreshStore.lookup(refreshToken)).toBeNull();
    await app.close();
  });

  it('org-wide mfa_required forces challenge for enrolled users', async () => {
    const { app, repo } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { accessToken, user } = signupRes.json();
    await enrollAndConfirm(app, accessToken);
    // Flip tenant policy.
    const tenant = repo.tenants.get(user.tenantId);
    if (!tenant) throw new Error('tenant missing');
    tenant.mfaRequired = true;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: signupBody.email, password: signupBody.password },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.kind).toBe('mfa-required');
    expect(body.enrollmentRequired).toBe(false);
    await app.close();
  });

  it('org-wide mfa_required + un-enrolled user → enrollmentRequired=true and verify-mfa refuses', async () => {
    const { app, repo } = await buildTestApp();
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: signupBody,
    });
    const { user } = signupRes.json();
    const tenant = repo.tenants.get(user.tenantId);
    if (!tenant) throw new Error('tenant missing');
    tenant.mfaRequired = true;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: signupBody.email, password: signupBody.password },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.kind).toBe('mfa-required');
    expect(body.enrollmentRequired).toBe(true);

    const verify = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login/verify-mfa',
      payload: { challengeToken: body.challengeToken, code: '000000' },
    });
    expect(verify.statusCode).toBe(401);
    await app.close();
  });

  it('mfa enroll requires authentication', async () => {
    const { app } = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/enroll',
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

// Removed test-only exports — Biome `noExportsInTest` flags them. The
// helpers were never imported elsewhere; the route-level tests above
// exercise the full MFA surface end-to-end via `fastify.inject`.
