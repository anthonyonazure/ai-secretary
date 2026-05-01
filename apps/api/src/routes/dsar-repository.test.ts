import { describe, expect, it } from 'vitest';
import { InMemoryDsarRepository } from './dsar-repository.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444';

describe('InMemoryDsarRepository', () => {
  it('creates a queued row with the supplied expiresAt', async () => {
    const repo = new InMemoryDsarRepository();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const row = await repo.create({ tenantId: TENANT_ID, userId: USER_ID, expiresAt });
    expect(row.status).toBe('queued');
    expect(row.tenantId).toBe(TENANT_ID);
    expect(row.userId).toBe(USER_ID);
    expect(row.expiresAt?.getTime()).toBe(expiresAt.getTime());
    expect(row.downloadUrl).toBeNull();
  });

  it('findActiveForUser returns queued rows', async () => {
    const repo = new InMemoryDsarRepository();
    await repo.create({
      tenantId: TENANT_ID,
      userId: USER_ID,
      expiresAt: new Date(),
    });
    const active = await repo.findActiveForUser(TENANT_ID, USER_ID);
    expect(active).not.toBeNull();
    expect(active?.status).toBe('queued');
  });

  it('findActiveForUser returns processing rows', async () => {
    const repo = new InMemoryDsarRepository();
    const created = await repo.create({
      tenantId: TENANT_ID,
      userId: USER_ID,
      expiresAt: new Date(),
    });
    await repo.markProcessing(created.id);
    const active = await repo.findActiveForUser(TENANT_ID, USER_ID);
    expect(active?.status).toBe('processing');
  });

  it('findActiveForUser returns null once row is ready', async () => {
    const repo = new InMemoryDsarRepository();
    const created = await repo.create({
      tenantId: TENANT_ID,
      userId: USER_ID,
      expiresAt: new Date(),
    });
    await repo.markReady(created.id, {
      storageKey: 'dsar-exports/t/r.zip',
      downloadUrl: 'https://example.test/foo',
      downloadExpiresAt: new Date(Date.now() + 1000),
      sizeBytes: 1024,
    });
    const active = await repo.findActiveForUser(TENANT_ID, USER_ID);
    expect(active).toBeNull();
  });

  it('findById is tenant-scoped', async () => {
    const repo = new InMemoryDsarRepository();
    const a = await repo.create({
      tenantId: TENANT_ID,
      userId: USER_ID,
      expiresAt: new Date(),
    });
    expect(await repo.findById(TENANT_ID, a.id)).not.toBeNull();
    expect(await repo.findById(OTHER_TENANT_ID, a.id)).toBeNull();
  });

  it('findByUser returns only the matching tenant+user rows newest first', async () => {
    const repo = new InMemoryDsarRepository();
    const expiresAt = new Date();
    const r1 = await repo.create({ tenantId: TENANT_ID, userId: USER_ID, expiresAt });
    // Force ordering — sleep-free: rewrite createdAt directly.
    r1.createdAt = new Date(r1.createdAt.getTime() - 5000);
    const r2 = await repo.create({ tenantId: TENANT_ID, userId: USER_ID, expiresAt });
    await repo.create({ tenantId: TENANT_ID, userId: OTHER_USER_ID, expiresAt });
    await repo.create({ tenantId: OTHER_TENANT_ID, userId: USER_ID, expiresAt });
    const rows = await repo.findByUser(TENANT_ID, USER_ID);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe(r2.id);
    expect(rows[1]?.id).toBe(r1.id);
  });

  it('markReady persists download metadata', async () => {
    const repo = new InMemoryDsarRepository();
    const created = await repo.create({
      tenantId: TENANT_ID,
      userId: USER_ID,
      expiresAt: new Date(),
    });
    const expiresAt = new Date(Date.now() + 60_000);
    await repo.markReady(created.id, {
      storageKey: 'dsar-exports/t/r.zip',
      downloadUrl: 'https://example.test/zip',
      downloadExpiresAt: expiresAt,
      sizeBytes: 4096,
    });
    const row = await repo.findById(TENANT_ID, created.id);
    expect(row?.status).toBe('ready');
    expect(row?.storageKey).toBe('dsar-exports/t/r.zip');
    expect(row?.downloadUrl).toBe('https://example.test/zip');
    expect(row?.sizeBytes).toBe(4096);
    expect(row?.readyAt).not.toBeNull();
  });

  it('markFailed persists a truncated reason', async () => {
    const repo = new InMemoryDsarRepository();
    const created = await repo.create({
      tenantId: TENANT_ID,
      userId: USER_ID,
      expiresAt: new Date(),
    });
    const longReason = 'x'.repeat(1000);
    await repo.markFailed(created.id, longReason);
    const row = await repo.findById(TENANT_ID, created.id);
    expect(row?.status).toBe('failed');
    expect(row?.failureReason?.length).toBe(500);
  });
});
