import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import type { Env } from '../env.js';
import { type ConsentCheckerFn, consentCheckPlugin } from './consent-check.js';
import { errorHandlerPlugin } from './error-handler.js';
import { requestIdPlugin } from './request-id.js';
import { tenantContextPlugin } from './tenant-context.js';

const devEnv: Pick<Env, 'NODE_ENV' | 'REGION'> = {
  NODE_ENV: 'development',
  REGION: 'us',
};

const TENANT = '11111111-1111-1111-1111-111111111111';
const MEETING_OK = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MEETING_MISSING = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const buildTestApp = async (consentChecker?: ConsentCheckerFn): Promise<FastifyInstance> => {
  const fastify = Fastify({ logger: false });
  await fastify.register(errorHandlerPlugin);
  await fastify.register(requestIdPlugin);
  await fastify.register(tenantContextPlugin, { env: devEnv });
  await fastify.register(consentCheckPlugin, consentChecker ? { consentChecker } : {});
  return fastify;
};

describe('consent-check plugin', () => {
  it('passes through when route does not opt in', async () => {
    const fastify = await buildTestApp();
    fastify.get('/no-consent', async () => ({ ok: true }));
    await fastify.ready();
    const res = await fastify.inject({
      method: 'GET',
      url: '/no-consent',
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(200);
    await fastify.close();
  });

  it('returns 403 when route opts in and consent is missing (default fail-closed)', async () => {
    const fastify = await buildTestApp();
    fastify.post(
      '/recordings/:meetingId/heartbeat',
      { config: { requireConsent: true } },
      async () => ({ ok: true }),
    );
    await fastify.ready();
    const res = await fastify.inject({
      method: 'POST',
      url: `/recordings/${MEETING_MISSING}/heartbeat`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(403);
    await fastify.close();
  });

  it('lets the request through when injected checker returns ok', async () => {
    const fastify = await buildTestApp(async (_tenantId, meetingId) =>
      meetingId === MEETING_OK ? 'ok' : 'missing',
    );
    fastify.post(
      '/recordings/:meetingId/heartbeat',
      { config: { requireConsent: true } },
      async () => ({ ok: true }),
    );
    await fastify.ready();
    const ok = await fastify.inject({
      method: 'POST',
      url: `/recordings/${MEETING_OK}/heartbeat`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(ok.statusCode).toBe(200);
    const denied = await fastify.inject({
      method: 'POST',
      url: `/recordings/${MEETING_MISSING}/heartbeat`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(denied.statusCode).toBe(403);
    await fastify.close();
  });

  it('respects custom meetingIdParam override', async () => {
    const fastify = await buildTestApp(async (_tenantId, meetingId) =>
      meetingId === MEETING_OK ? 'ok' : 'missing',
    );
    fastify.post(
      '/meetings/:id/transcribe',
      { config: { requireConsent: { meetingIdParam: 'id' } } },
      async () => ({ ok: true }),
    );
    await fastify.ready();
    const res = await fastify.inject({
      method: 'POST',
      url: `/meetings/${MEETING_OK}/transcribe`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(200);
    await fastify.close();
  });

  it('returns 403 when route param is missing', async () => {
    const fastify = await buildTestApp();
    fastify.post('/recordings/heartbeat', { config: { requireConsent: true } }, async () => ({
      ok: true,
    }));
    await fastify.ready();
    const res = await fastify.inject({
      method: 'POST',
      url: '/recordings/heartbeat',
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(403);
    await fastify.close();
  });
});
