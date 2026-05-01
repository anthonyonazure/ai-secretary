import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FREE_SNAPSHOT,
  type EntitlementSnapshot,
  InMemoryEntitlementRepository,
  entitlementCheckPlugin,
} from './entitlement-check.js';
import { errorHandlerPlugin } from './error-handler.js';

const TENANT = randomUUID();

// Stand-in for the real tenant-context plugin — declares the
// `tenant-context` plugin name so fastify-plugin's dependency check
// passes, then wires `request.tenantId` from a header.
const fakeTenantContext = fp(
  async (instance) => {
    instance.decorateRequest('tenantId', '');
    instance.addHook('onRequest', async (req) => {
      req.tenantId = TENANT;
    });
  },
  { name: 'tenant-context' },
);

const buildApp = async (snapshot?: EntitlementSnapshot) => {
  const repo = new InMemoryEntitlementRepository();
  if (snapshot) repo.set(TENANT, snapshot);
  const app = Fastify({ logger: false });
  await app.register(errorHandlerPlugin);
  await app.register(fakeTenantContext);
  await app.register(entitlementCheckPlugin, { repository: repo });
  app.get('/needs-bot', { config: { requireFeature: 'bot' } }, async () => ({ ok: true }));
  app.get('/needs-medical-module', { config: { requireModule: 'medical' } }, async () => ({
    ok: true,
  }));
  app.get('/no-gate', async () => ({ ok: true }));
  return app;
};

describe('entitlement-check plugin', () => {
  it('lets requests through when there is no requireFeature / requireModule config', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/no-gate' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('rejects with 403 when the feature flag is off (free tier default)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/needs-bot' });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('entitlement-required');
    expect(body.upsell).toMatchObject({ minimumTier: 'pro', feature: 'bot' });
    await app.close();
  });

  it('lets requests through when the feature is enabled', async () => {
    const app = await buildApp({ ...DEFAULT_FREE_SNAPSHOT, tierId: 'pro', botEnabled: true });
    const res = await app.inject({ method: 'GET', url: '/needs-bot' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('rejects with 403 when the required module is not in the enabled set', async () => {
    const app = await buildApp({
      ...DEFAULT_FREE_SNAPSHOT,
      tierId: 'pro',
      enabledModuleIds: ['general', 'sales'],
    });
    const res = await app.inject({ method: 'GET', url: '/needs-medical-module' });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('module-required');
    expect(body.upsell).toMatchObject({ minimumTier: 'business', module: 'medical' });
    await app.close();
  });

  it('lets the request through when the module is enabled', async () => {
    const app = await buildApp({
      ...DEFAULT_FREE_SNAPSHOT,
      tierId: 'business',
      enabledModuleIds: ['general', 'medical'],
    });
    const res = await app.inject({ method: 'GET', url: '/needs-medical-module' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('falls back to the default free-tier snapshot when no row exists for the tenant', async () => {
    const app = await buildApp(); // no snapshot seeded
    const res = await app.inject({ method: 'GET', url: '/needs-bot' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
