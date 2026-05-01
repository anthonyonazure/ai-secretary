import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { Env } from '../env.js';
import { errorHandlerPlugin } from './error-handler.js';
import { requestIdPlugin } from './request-id.js';
import { tenantContextPlugin } from './tenant-context.js';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

const buildTestApp = async (env: Pick<Env, 'NODE_ENV' | 'REGION'>) => {
  const fastify = Fastify({ logger: false });
  await fastify.register(errorHandlerPlugin);
  await fastify.register(requestIdPlugin);
  // Health route — registered before tenant-context, marked exempt.
  fastify.get('/healthz', { config: { skipTenantContext: true } }, async () => ({
    status: 'ok',
  }));
  await fastify.register(tenantContextPlugin, { env });
  fastify.get('/tenant', async (request) => ({
    tenantId: request.tenantId,
    region: request.region,
    userId: request.user?.userId ?? null,
  }));
  await fastify.ready();
  return fastify;
};

describe('tenant-context plugin', () => {
  it('accepts x-tenant-id header in development', async () => {
    const app = await buildTestApp({ NODE_ENV: 'development', REGION: 'us' });
    const res = await app.inject({
      method: 'GET',
      url: '/tenant',
      headers: { 'x-tenant-id': TENANT_ID, 'x-user-id': USER_ID },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tenantId).toBe(TENANT_ID);
    expect(body.region).toBe('us');
    expect(body.userId).toBe(USER_ID);
    await app.close();
  });

  it('rejects requests without tenant context with 401 in production', async () => {
    const app = await buildTestApp({ NODE_ENV: 'production', REGION: 'us' });
    const res = await app.inject({
      method: 'GET',
      url: '/tenant',
      headers: { 'x-tenant-id': TENANT_ID }, // header path disabled in prod
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.title).toBe('Unauthorized');
    expect(body.requestId).toBeTruthy();
    await app.close();
  });

  it('rejects requests with missing header in test env (fail-closed)', async () => {
    const app = await buildTestApp({ NODE_ENV: 'test', REGION: 'eu' });
    const res = await app.inject({ method: 'GET', url: '/tenant' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('exempts routes with config.skipTenantContext=true', async () => {
    const app = await buildTestApp({ NODE_ENV: 'production', REGION: 'us' });
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('rejects malformed tenant ids (must be UUID)', async () => {
    const app = await buildTestApp({ NODE_ENV: 'development', REGION: 'us' });
    const res = await app.inject({
      method: 'GET',
      url: '/tenant',
      headers: { 'x-tenant-id': 'not-a-uuid' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('emits region from env', async () => {
    const app = await buildTestApp({ NODE_ENV: 'development', REGION: 'eu' });
    const res = await app.inject({
      method: 'GET',
      url: '/tenant',
      headers: { 'x-tenant-id': TENANT_ID },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().region).toBe('eu');
    await app.close();
  });
});
