/**
 * Story 14.5 — `InMemoryAuditExportRepository` unit tests.
 *
 * The in-memory variant powers the audit-export route's test path.
 * We lock the filter semantics (tenant isolation, [since, until)
 * window, action + resource-type filters) and the newest-first sort.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  type AuditExportRowInternal,
  InMemoryAuditExportRepository,
} from './audit-export-repository.js';

const tenantId = randomUUID();

const row = (overrides: Partial<AuditExportRowInternal> = {}): AuditExportRowInternal => ({
  id: randomUUID(),
  tenantId,
  actorUserId: randomUUID(),
  action: 'meeting.created',
  resourceType: 'meeting',
  resourceId: randomUUID(),
  metadata: {},
  requestId: 'req-1',
  region: 'us',
  ipAddress: null,
  userAgent: null,
  createdAt: new Date('2026-04-30T12:00:00Z'),
  ...overrides,
});

describe('InMemoryAuditExportRepository.list', () => {
  it('returns rows for the requested tenant only', async () => {
    const repo = new InMemoryAuditExportRepository();
    repo.rows.push(row({ tenantId }));
    repo.rows.push(row({ tenantId: randomUUID() }));
    const result = await repo.list({
      tenantId,
      since: new Date('2026-04-01T00:00:00Z'),
      until: new Date('2026-05-01T00:00:00Z'),
      limit: 100,
    });
    expect(result.items).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it('respects the [since, until) window', async () => {
    const repo = new InMemoryAuditExportRepository();
    const since = new Date('2026-04-30T11:00:00Z');
    const until = new Date('2026-04-30T13:00:00Z');
    repo.rows.push(row({ createdAt: new Date('2026-04-30T10:00:00Z') })); // before since
    repo.rows.push(row({ createdAt: new Date('2026-04-30T12:00:00Z') })); // in window
    repo.rows.push(row({ createdAt: until })); // exclusive upper bound
    repo.rows.push(row({ createdAt: new Date('2026-04-30T14:00:00Z') })); // after until
    const result = await repo.list({ tenantId, since, until, limit: 100 });
    expect(result.totalCount).toBe(1);
  });

  it('filters by action when actions[] is provided', async () => {
    const repo = new InMemoryAuditExportRepository();
    repo.rows.push(row({ action: 'meeting.created' }));
    repo.rows.push(row({ action: 'share.created' }));
    repo.rows.push(row({ action: 'consent.acknowledged' }));
    const result = await repo.list({
      tenantId,
      since: new Date('2026-04-01T00:00:00Z'),
      until: new Date('2026-05-01T00:00:00Z'),
      actions: ['share.created', 'consent.acknowledged'],
      limit: 100,
    });
    expect(result.items.map((r) => r.action).sort()).toEqual([
      'consent.acknowledged',
      'share.created',
    ]);
  });

  it('filters by resource type', async () => {
    const repo = new InMemoryAuditExportRepository();
    repo.rows.push(row({ resourceType: 'meeting' }));
    repo.rows.push(row({ resourceType: 'share' }));
    const result = await repo.list({
      tenantId,
      since: new Date('2026-04-01T00:00:00Z'),
      until: new Date('2026-05-01T00:00:00Z'),
      resourceType: 'share',
      limit: 100,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.resourceType).toBe('share');
  });

  it('sorts results newest-first', async () => {
    const repo = new InMemoryAuditExportRepository();
    repo.rows.push(row({ id: 'a', createdAt: new Date('2026-04-30T10:00:00Z') }));
    repo.rows.push(row({ id: 'b', createdAt: new Date('2026-04-30T13:00:00Z') }));
    repo.rows.push(row({ id: 'c', createdAt: new Date('2026-04-30T11:00:00Z') }));
    const result = await repo.list({
      tenantId,
      since: new Date('2026-04-01T00:00:00Z'),
      until: new Date('2026-05-01T00:00:00Z'),
      limit: 100,
    });
    expect(result.items.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('caps the items at limit but preserves totalCount', async () => {
    const repo = new InMemoryAuditExportRepository();
    for (let i = 0; i < 10; i += 1) {
      repo.rows.push(row({ createdAt: new Date(`2026-04-30T1${i}:00:00Z`) }));
    }
    const result = await repo.list({
      tenantId,
      since: new Date('2026-04-30T00:00:00Z'),
      until: new Date('2026-05-01T00:00:00Z'),
      limit: 3,
    });
    expect(result.items).toHaveLength(3);
    expect(result.totalCount).toBe(10);
  });

  it('returns empty for a tenant with no audit entries', async () => {
    const repo = new InMemoryAuditExportRepository();
    const result = await repo.list({
      tenantId: randomUUID(),
      since: new Date(0),
      until: new Date(),
      limit: 100,
    });
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
  });
});
