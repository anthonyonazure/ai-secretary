import { describe, expect, it } from 'vitest';

import type { Env } from '../env.js';
import { buildServer } from '../server.js';

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  HOST: '0.0.0.0',
  REGION: 'us',
  DATABASE_URL: 'postgres://localhost:5432/aisecretary_test',
  JWT_SECRET: 'test-secret-must-be-at-least-32-chars-long-please',
  LOG_LEVEL: 'error',
};

describe('Health routes', () => {
  it('GET /healthz returns ok', async () => {
    const app = await buildServer({ env: TEST_ENV, consentChecker: async () => 'ok' });
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('GET /readyz returns ready', async () => {
    const app = await buildServer({ env: TEST_ENV, consentChecker: async () => 'ok' });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready' });
    await app.close();
  });

  it('GET /healthz/summary returns build + region + uptime', async () => {
    const app = await buildServer({ env: TEST_ENV, consentChecker: async () => 'ok' });
    const res = await app.inject({ method: 'GET', url: '/healthz/summary' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.buildSha).toBe('string');
    expect(typeof body.region).toBe('string');
    expect(body.nodeVersion).toMatch(/^v\d+\.\d+/);
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(typeof body.now).toBe('string');
    await app.close();
  });

  it('all health routes are auth-free', async () => {
    const app = await buildServer({ env: TEST_ENV, consentChecker: async () => 'ok' });
    // No Authorization header — should still 200.
    const res = await app.inject({ method: 'GET', url: '/healthz/summary' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
