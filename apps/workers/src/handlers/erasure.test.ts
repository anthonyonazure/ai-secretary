import { randomUUID } from 'node:crypto';
import type { Db } from '@aisecretary/db';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { cascadeSourceSkippedExecutor, noopCascadeFkExecutor } from '../lib/erasure-runner.js';
import type { ErasureCascadeEntry } from '../lib/erasure-types.js';
import { createErasureHandler } from './erasure.js';

/**
 * Fake `Db` for the handler — `withJobContext` calls
 * `db.transaction(fn)` first, runs `set_config` SQL inside, then
 * invokes `fn(tx)`. The fake skips the SQL and forwards directly.
 */
const buildFakeDb = (): Db => {
  const txStub = {
    execute: async () => undefined,
  };
  return {
    transaction: async <T>(fn: (tx: typeof txStub) => Promise<T>): Promise<T> => fn(txStub),
  } as unknown as Db;
};

const buildLogger = () => pino({ level: 'silent' });

const FIXTURE_CASCADE: ErasureCascadeEntry[] = [
  { table: 'tenants', strategy: 'cascade-source', notes: '' },
  { table: 'users', strategy: 'cascade', notes: '' },
  { table: 'meetings', strategy: 'shred', notes: '' },
  { table: 'audit_logs', strategy: 'redact', notes: '' },
];

describe('createErasureHandler', () => {
  it('rejects an invalid payload', async () => {
    const handler = createErasureHandler({
      db: buildFakeDb(),
      logger: buildLogger(),
      cascade: FIXTURE_CASCADE,
    });
    await expect(
      handler({ data: { tenantId: 'not-a-uuid', userId: '', region: 'us' } as never }),
    ).rejects.toThrow(/invalid payload/);
  });

  it('walks the cascade through the registry factory and returns the report', async () => {
    const meetingsExec = vi.fn(async () => ({ rowsAffected: 7, action: 'shred' as const }));
    const auditLogsExec = vi.fn(async () => ({ rowsAffected: 14, action: 'redact' as const }));

    const handler = createErasureHandler({
      db: buildFakeDb(),
      logger: buildLogger(),
      cascade: FIXTURE_CASCADE,
      registryFactory: () => ({
        tenants: cascadeSourceSkippedExecutor,
        users: noopCascadeFkExecutor,
        meetings: meetingsExec,
        audit_logs: auditLogsExec,
      }),
    });

    const report = await handler({
      data: { tenantId: randomUUID(), userId: randomUUID(), region: 'us' },
    });
    expect(report.fullyHandled).toBe(true);
    expect(meetingsExec).toHaveBeenCalledOnce();
    expect(auditLogsExec).toHaveBeenCalledOnce();
    expect(report.stages.find((s) => s.table === 'meetings')?.result).toMatchObject({
      kind: 'ran',
      rowsAffected: 7,
    });
  });

  it('emits a structure-log warn when the registry has gaps (fullyHandled=false)', async () => {
    const sink: Array<{ level: string; msg: string; obj: unknown }> = [];
    const logger = pino(
      { level: 'info' },
      {
        write: (s: string) => {
          const parsed = JSON.parse(s) as Record<string, unknown>;
          sink.push({
            level: String(parsed.level),
            msg: String(parsed.msg ?? ''),
            obj: parsed,
          });
        },
      },
    );

    const handler = createErasureHandler({
      db: buildFakeDb(),
      logger,
      cascade: FIXTURE_CASCADE,
      registryFactory: () => ({
        tenants: cascadeSourceSkippedExecutor,
        users: noopCascadeFkExecutor,
        // meetings + audit_logs intentionally absent
      }),
    });
    const report = await handler({
      data: { tenantId: randomUUID(), userId: randomUUID(), region: 'us' },
    });
    expect(report.fullyHandled).toBe(false);
    const unhandled = sink.filter((s) => s.msg === 'erasure: stage-unhandled');
    expect(unhandled.length).toBe(2);
  });
});
