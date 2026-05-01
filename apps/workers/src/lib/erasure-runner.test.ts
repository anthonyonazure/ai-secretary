import { describe, expect, it, vi } from 'vitest';

import {
  type TableExecutorRegistry,
  cascadeSourceSkippedExecutor,
  noopCascadeFkExecutor,
  noopOutOfScopeExecutor,
  runErasureCascade,
} from './erasure-runner.js';
import type { ErasureCascadeEntry, ErasureStrategy } from './erasure-types.js';

const SCOPE = { tenantId: 't-1', userId: 'u-1' };

const fixtureCascade: ErasureCascadeEntry[] = [
  { table: 'tenants', strategy: 'cascade-source', notes: 'root' },
  { table: 'users', strategy: 'cascade', notes: 'fk cascade from tenants' },
  { table: 'meetings', strategy: 'shred', notes: 'audio + transcripts PII' },
  { table: 'audit_logs', strategy: 'redact', notes: 'preserve trail; redact PII' },
];

describe('runErasureCascade', () => {
  it('walks the registry in declared order and emits one stage per table', async () => {
    const registry: TableExecutorRegistry = {
      tenants: cascadeSourceSkippedExecutor,
      users: noopCascadeFkExecutor,
      meetings: vi.fn(async () => ({ rowsAffected: 12, action: 'shred' as const })),
      audit_logs: vi.fn(async () => ({ rowsAffected: 47, action: 'redact' as const })),
    };

    const report = await runErasureCascade(fixtureCascade, registry, SCOPE, null);
    expect(report.fullyHandled).toBe(true);
    expect(report.scope).toEqual(SCOPE);
    expect(report.stages.map((s) => s.table)).toEqual([
      'tenants',
      'users',
      'meetings',
      'audit_logs',
    ]);
  });

  it('passes the scope and host through to each executor', async () => {
    const seen: Array<{ tenantId: string; userId: string; host: unknown }> = [];
    const registry: TableExecutorRegistry = {
      tenants: cascadeSourceSkippedExecutor,
      users: noopCascadeFkExecutor,
      meetings: async (ctx) => {
        seen.push({ tenantId: ctx.tenantId, userId: ctx.userId, host: ctx.host });
        return { rowsAffected: 0, action: 'shred' };
      },
      audit_logs: async (ctx) => {
        seen.push({ tenantId: ctx.tenantId, userId: ctx.userId, host: ctx.host });
        return { rowsAffected: 0, action: 'redact' };
      },
    };

    const host = { tx: 'fake-tx', storage: 'fake-storage' };
    await runErasureCascade(fixtureCascade, registry, SCOPE, host);
    expect(seen).toEqual([
      { tenantId: 't-1', userId: 'u-1', host },
      { tenantId: 't-1', userId: 'u-1', host },
    ]);
  });

  it('marks tables without an executor as unhandled and continues', async () => {
    const registry: TableExecutorRegistry = {
      tenants: cascadeSourceSkippedExecutor,
      users: noopCascadeFkExecutor,
      // meetings + audit_logs intentionally omitted
    };

    const report = await runErasureCascade(fixtureCascade, registry, SCOPE, null);
    expect(report.fullyHandled).toBe(false);
    const meetings = report.stages.find((s) => s.table === 'meetings');
    expect(meetings?.result.kind).toBe('unhandled');
    if (meetings?.result.kind === 'unhandled') {
      expect(meetings.result.reason).toMatch(/no executor/);
    }
    // Other stages still ran.
    const tenants = report.stages.find((s) => s.table === 'tenants');
    expect(tenants?.result.kind).toBe('ran');
  });

  it('cascadeSourceSkippedExecutor never touches rows', async () => {
    const result = await cascadeSourceSkippedExecutor({ ...SCOPE, host: null });
    expect(result.rowsAffected).toBe(0);
    expect(result.action).toBe('cascade-source-skipped');
  });

  it('noopCascadeFkExecutor never touches rows', async () => {
    const result = await noopCascadeFkExecutor({ ...SCOPE, host: null });
    expect(result.rowsAffected).toBe(0);
    expect(result.action).toBe('cascade-fk');
  });

  it('noopOutOfScopeExecutor never touches rows', async () => {
    const result = await noopOutOfScopeExecutor({ ...SCOPE, host: null });
    expect(result.rowsAffected).toBe(0);
    expect(result.action).toBe('noop-out-of-scope');
  });
});

describe('runErasureCascade — strategy-mapped audit shape', () => {
  it('preserves strategy on each stage so audit emits include it', async () => {
    const registry: TableExecutorRegistry = {
      tenants: cascadeSourceSkippedExecutor,
      users: noopCascadeFkExecutor,
      meetings: async () => ({ rowsAffected: 1, action: 'shred' }),
      audit_logs: async () => ({ rowsAffected: 2, action: 'redact' }),
    };
    const report = await runErasureCascade(fixtureCascade, registry, SCOPE, null);
    const strategiesByTable: Record<string, ErasureStrategy> = {};
    for (const stage of report.stages) {
      strategiesByTable[stage.table] = stage.strategy;
    }
    expect(strategiesByTable).toEqual({
      tenants: 'cascade-source',
      users: 'cascade',
      meetings: 'shred',
      audit_logs: 'redact',
    });
  });
});
