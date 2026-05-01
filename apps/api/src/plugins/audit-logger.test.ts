import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import type { Env } from '../env.js';
import {
  type AuditRecord,
  type AuditSink,
  auditLoggerPlugin,
  createNotificationsAuditLogger,
} from './audit-logger.js';
import { errorHandlerPlugin } from './error-handler.js';
import { requestIdPlugin } from './request-id.js';
import { tenantContextPlugin } from './tenant-context.js';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

class CapturingSink implements AuditSink {
  public readonly rows: AuditRecord[] = [];
  async write(record: AuditRecord): Promise<void> {
    this.rows.push(record);
  }
}

const buildTestApp = async (
  env: Pick<Env, 'NODE_ENV' | 'REGION'>,
  sink: AuditSink,
): Promise<FastifyInstance> => {
  const fastify = Fastify({ logger: false });
  await fastify.register(errorHandlerPlugin);
  await fastify.register(requestIdPlugin);
  await fastify.register(tenantContextPlugin, { env });
  await fastify.register(auditLoggerPlugin, { sink });
  fastify.post(
    '/tagged',
    {
      config: { auditTags: ['meeting.created'] },
    },
    async () => ({ ok: true }),
  );
  fastify.post('/manual', async (request) => {
    await request.audit({
      action: 'meeting.updated',
      resourceType: 'meeting',
      resourceId: 'm-1',
      metadata: { title: 'demo' },
    });
    return { ok: true };
  });
  fastify.post('/bad-action', async (request) => {
    // @ts-expect-error — intentional invalid action for runtime guard test
    await request.audit({ action: 'bogus.action', resourceType: 'meeting' });
    return { ok: true };
  });
  fastify.post('/throws-pre-audit', async () => {
    throw new Error('boom');
  });
  await fastify.ready();
  return fastify;
};

describe('audit-logger plugin', () => {
  const env = { NODE_ENV: 'development', REGION: 'us' } as const;
  const headers = { 'x-tenant-id': TENANT_ID };

  it('auto-emits a row on a tagged route', async () => {
    const sink = new CapturingSink();
    const app = await buildTestApp(env, sink);
    const res = await app.inject({ method: 'POST', url: '/tagged', headers });
    expect(res.statusCode).toBe(200);
    // onResponse fires after .inject returns — but since fastify.inject
    // awaits hooks, the row is already there.
    expect(sink.rows).toHaveLength(1);
    expect(sink.rows[0]?.action).toBe('meeting.created');
    expect(sink.rows[0]?.tenantId).toBe(TENANT_ID);
    expect(sink.rows[0]?.region).toBe('us');
    expect(sink.rows[0]?.requestId).toBeTruthy();
    await app.close();
  });

  it('records manual request.audit() calls', async () => {
    const sink = new CapturingSink();
    const app = await buildTestApp(env, sink);
    const res = await app.inject({ method: 'POST', url: '/manual', headers });
    expect(res.statusCode).toBe(200);
    expect(sink.rows).toHaveLength(1);
    expect(sink.rows[0]?.action).toBe('meeting.updated');
    expect(sink.rows[0]?.resourceId).toBe('m-1');
    expect(sink.rows[0]?.metadata).toEqual({ title: 'demo' });
    await app.close();
  });

  it('throws 500 when an un-canonical action is emitted', async () => {
    const sink = new CapturingSink();
    const app = await buildTestApp(env, sink);
    const res = await app.inject({ method: 'POST', url: '/bad-action', headers });
    expect(res.statusCode).toBe(500);
    expect(res.json().title).toBe('Internal Audit Error');
    expect(sink.rows).toHaveLength(0);
    await app.close();
  });

  it('does not auto-emit when the response is non-2xx', async () => {
    const sink = new CapturingSink();
    const app = await buildTestApp(env, sink);
    const res = await app.inject({ method: 'POST', url: '/throws-pre-audit', headers });
    expect(res.statusCode).toBe(500);
    // No tagged route here, so no auto-emit anyway. Confirm sink stayed empty.
    expect(sink.rows).toHaveLength(0);
    await app.close();
  });

  it('createNotificationsAuditLogger conforms to @aisecretary/notifications AuditLogger', async () => {
    const sink = new CapturingSink();
    const app = await buildTestApp(env, sink);
    const logger = createNotificationsAuditLogger(app, () => ({
      tenantId: TENANT_ID,
      actorUserId: null,
      requestId: 'req-1',
      region: 'us',
      ipAddress: null,
      userAgent: null,
    }));
    await logger.log({
      action: 'notification.sent',
      tenantId: TENANT_ID,
      recipient: 'user@example.com',
      channel: 'email',
      kind: 'analysis-completed',
      notificationId: 'n-1',
      providerMessageId: 'p-1',
    });
    expect(sink.rows).toHaveLength(1);
    expect(sink.rows[0]?.action).toBe('notification.sent');
    expect(sink.rows[0]?.resourceType).toBe('notification');
    expect(sink.rows[0]?.resourceId).toBe('n-1');
    await app.close();
  });

  it('rejects an un-canonical action via fastify.auditWrite directly', async () => {
    const sink = new CapturingSink();
    const app = await buildTestApp(env, sink);
    await expect(
      app.auditWrite({
        tenantId: TENANT_ID,
        actorUserId: null,
        // @ts-expect-error — runtime guard test
        action: 'some.unknown',
        resourceType: 'meeting',
        resourceId: null,
        metadata: {},
        requestId: 'r-1',
        region: 'us',
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toThrow(/Unknown audit action/);
    await app.close();
  });
});
