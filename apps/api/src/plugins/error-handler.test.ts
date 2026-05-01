import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../lib/http-error.js';
import { errorHandlerPlugin } from './error-handler.js';
import { requestIdPlugin } from './request-id.js';

const buildTestApp = async () => {
  const fastify = Fastify({ logger: false });
  await fastify.register(errorHandlerPlugin);
  await fastify.register(requestIdPlugin);
  fastify.get('/validation', async () => {
    throw new ValidationError('field foo is required');
  });
  fastify.get('/not-found', async () => {
    throw new NotFoundError('resource not found');
  });
  fastify.get('/forbidden', async () => {
    throw new ForbiddenError('not allowed');
  });
  fastify.get('/conflict', async () => {
    throw new ConflictError('already exists');
  });
  fastify.get('/rate-limit', async () => {
    throw new RateLimitError('slow down');
  });
  fastify.get('/zod', async () => {
    z.object({ x: z.string() }).parse({ x: 1 });
    return { ok: true };
  });
  fastify.get('/unknown', async () => {
    throw new Error('boom');
  });
  await fastify.ready();
  return fastify;
};

describe('error-handler plugin (RFC 7807)', () => {
  it('converts ValidationError to 422 problem+json', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/validation' });
    expect(res.statusCode).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json();
    expect(body.title).toBe('Validation Failed');
    expect(body.status).toBe(422);
    expect(body.detail).toBe('field foo is required');
    expect(body.requestId).toBeTruthy();
    expect(body.instance).toBe('/validation');
    expect(body.type).toBe('https://aisecretary.app/errors/validation');
    await app.close();
  });

  it('converts NotFoundError to 404', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/not-found' });
    expect(res.statusCode).toBe(404);
    expect(res.json().title).toBe('Not Found');
    await app.close();
  });

  it('converts ForbiddenError to 403', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/forbidden' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('converts ConflictError to 409', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/conflict' });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it('converts RateLimitError to 429', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/rate-limit' });
    expect(res.statusCode).toBe(429);
    await app.close();
  });

  it('converts ZodError to 422 with structured errors extension', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/zod' });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.title).toBe('Validation Failed');
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors[0].path).toBe('x');
    await app.close();
  });

  it('converts unknown errors to safe 500', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/unknown' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.title).toBe('Internal Server Error');
    expect(body.detail).toBe('Internal server error'); // safe message — no leak
    expect(body.requestId).toBeTruthy();
    await app.close();
  });

  it('always includes requestId in error responses', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/validation',
      headers: { 'x-request-id': 'test-req-123' },
    });
    expect(res.json().requestId).toBe('test-req-123');
    expect(res.headers['x-request-id']).toBe('test-req-123');
    await app.close();
  });
});
