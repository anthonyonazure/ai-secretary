import { signAccessToken } from '@aisecretary/auth';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { errorHandlerPlugin } from './error-handler.js';
import { jwtPlugin } from './jwt.js';
import { requestIdPlugin } from './request-id.js';

const SECRET = 'unit-test-secret-must-be-at-least-32-chars-long';

const buildApp = async () => {
  const fastify = Fastify({ logger: false });
  await fastify.register(errorHandlerPlugin);
  await fastify.register(requestIdPlugin);
  // tenant-context isn't needed here; we manually decorate `request.user`.
  fastify.decorateRequest('user', null);
  await fastify.register(jwtPlugin, { secret: SECRET });
  fastify.get('/whoami', async (request) => ({ user: request.user }));
  await fastify.ready();
  return fastify;
};

describe('jwt plugin', () => {
  it('populates request.user when a valid Bearer token is present', async () => {
    const { token } = await signAccessToken({
      user: {
        userId: '11111111-1111-1111-1111-111111111111',
        tenantId: '22222222-2222-2222-2222-222222222222',
        region: 'us',
        role: 'org_admin',
      },
      secret: SECRET,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.userId).toBe('11111111-1111-1111-1111-111111111111');
    expect(body.user.tenantId).toBe('22222222-2222-2222-2222-222222222222');
    expect(body.user.region).toBe('us');
    expect(body.user.role).toBe('org_admin');
    await app.close();
  });

  it('leaves request.user null when Authorization header is missing', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/whoami' });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toBeNull();
    await app.close();
  });

  it('leaves request.user null when token is invalid', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: 'Bearer not-a-valid-jwt' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toBeNull();
    await app.close();
  });

  it('leaves request.user null when token was signed with a different secret', async () => {
    const { token } = await signAccessToken({
      user: {
        userId: '11111111-1111-1111-1111-111111111111',
        tenantId: '22222222-2222-2222-2222-222222222222',
        region: 'us',
        role: 'org_admin',
      },
      secret: 'this-is-a-different-secret-of-32-or-more-characters',
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toBeNull();
    await app.close();
  });
});
