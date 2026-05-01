import type { Db } from '@aisecretary/db';
import { describe, expect, it, vi } from 'vitest';
import type { AuditRecord } from '../plugins/audit-logger.js';
import { PostgresAuditSink } from './audit-sink-postgres.js';

// Mock `withTenantContext` so we don't need a live Postgres. Capture
// invocations and forward to the inner fn with a stub `tx`.
vi.mock('@aisecretary/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aisecretary/db')>();
  return {
    ...actual,
    // Forward the passed-in db as the "transaction" handle so the test
    // can supply a mock with `insert(...).values(...)`.
    withTenantContext: vi.fn(
      async <T>(
        db: unknown,
        _ctx: { tenantId: string; region: 'us' | 'eu'; userId?: string | null },
        fn: (db: unknown) => Promise<T>,
      ): Promise<T> => {
        return await fn(db);
      },
    ),
  };
});

describe('PostgresAuditSink', () => {
  const sampleRecord: AuditRecord = {
    tenantId: '11111111-1111-1111-1111-111111111111',
    actorUserId: '22222222-2222-2222-2222-222222222222',
    action: 'meeting.created',
    resourceType: 'meeting',
    resourceId: 'meeting-1',
    metadata: { foo: 'bar' },
    requestId: 'req-1',
    region: 'us',
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
  };

  it('writes via withTenantContext + drizzle insert', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
    const fakeDb = { insert: insertMock } as unknown as Db;

    const sink = new PostgresAuditSink(fakeDb);
    await sink.write(sampleRecord);

    const { withTenantContext } = await import('@aisecretary/db');
    expect(withTenantContext).toHaveBeenCalledTimes(1);
    const ctxArg = (withTenantContext as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    expect(ctxArg).toMatchObject({
      tenantId: sampleRecord.tenantId,
      region: 'us',
      userId: sampleRecord.actorUserId,
    });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: sampleRecord.tenantId,
        action: 'meeting.created',
        resourceType: 'meeting',
        resourceId: 'meeting-1',
        requestId: 'req-1',
        region: 'us',
      }),
    );
  });

  it('passes null userId through to withTenantContext when actorUserId is null', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
    const fakeDb = { insert: insertMock } as unknown as Db;

    const sink = new PostgresAuditSink(fakeDb);
    await sink.write({ ...sampleRecord, actorUserId: null });

    const { withTenantContext } = await import('@aisecretary/db');
    const ctxArg = (withTenantContext as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1];
    expect(ctxArg).toMatchObject({ userId: null });
  });
});
