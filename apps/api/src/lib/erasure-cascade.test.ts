import * as schema from '@aisecretary/db/schema';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { ERASURE_CASCADE, erasureTables, getErasureStrategy } from './erasure-cascade.js';

/**
 * Introspect every Drizzle pg-table exported from `@aisecretary/db/schema`
 * and assert that every tenant-scoped table (i.e. has a `tenant_id`
 * column) has a registered erasure strategy in `ERASURE_CASCADE`.
 *
 * If a future story adds a tenant-scoped table without registering it,
 * this test fails — same enforcement model as the audit-action union.
 */
const collectTenantScopedTables = (): string[] => {
  const tables: string[] = [];
  for (const value of Object.values(schema as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    // Drizzle PgTable has an internal symbol; getTableConfig throws on non-tables.
    try {
      // biome-ignore lint/suspicious/noExplicitAny: necessary for runtime introspection across drizzle table objects.
      const cfg = getTableConfig(value as any);
      const hasTenantId = cfg.columns.some((c) => c.name === 'tenant_id');
      const hasIdColumn = cfg.columns.some((c) => c.name === 'id');
      if (hasTenantId && hasIdColumn) {
        tables.push(cfg.name);
      } else if (cfg.name === 'tenants') {
        // The cascade source itself is included.
        tables.push(cfg.name);
      }
    } catch {
      // Not a table (enum, view, etc.) — skip.
    }
  }
  return Array.from(new Set(tables));
};

describe('erasure-cascade registry', () => {
  it('registers a strategy for every tenant-scoped Drizzle table', () => {
    const tenantScoped = collectTenantScopedTables();
    expect(tenantScoped.length).toBeGreaterThan(0);
    const missing = tenantScoped.filter((t) => getErasureStrategy(t) === undefined);
    expect(missing).toEqual([]);
  });

  it('contains exactly one cascade-source root', () => {
    const sources = ERASURE_CASCADE.filter((e) => e.strategy === 'cascade-source');
    expect(sources).toHaveLength(1);
    expect(sources[0]?.table).toBe('tenants');
  });

  it('marks audit_logs as redact (preserve trail of erasure)', () => {
    expect(getErasureStrategy('audit_logs')).toBe('redact');
  });

  it('marks meetings as shred (PII-heavy)', () => {
    expect(getErasureStrategy('meetings')).toBe('shred');
  });

  it('exposes erasureTables() with stable shape', () => {
    const tables = erasureTables();
    expect(tables).toContain('tenants');
    expect(tables).toContain('users');
    expect(tables).toContain('meetings');
    expect(tables).toContain('audit_logs');
  });
});
