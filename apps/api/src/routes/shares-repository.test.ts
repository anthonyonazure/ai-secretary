/**
 * Story 8.1 — `InMemorySharesRepository` unit tests.
 *
 * The in-memory variant is the source-of-truth for test fakes used by
 * higher-level route + integration tests. Verifying its tenant
 * isolation + state transitions here lets the upstream tests rely on
 * those invariants without restating them.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { InMemorySharesRepository, type ShareCreateInput } from './shares-repository.js';

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();

const baseInput = (overrides: Partial<ShareCreateInput> = {}): ShareCreateInput => ({
  tenantId: tenantA,
  meetingId: randomUUID(),
  createdByUserId: userA,
  kind: 'meeting',
  scope: 'viewer',
  recipientEmail: 'teammate@acme.test',
  tokenHash: null,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  clipStartMs: null,
  clipEndMs: null,
  insightModuleId: null,
  crossOrg: false,
  ...overrides,
});

describe('InMemorySharesRepository.create', () => {
  it('returns a row with a generated id + timestamps', async () => {
    const repo = new InMemorySharesRepository();
    const row = await repo.create(baseInput());
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);
  });

  it('initializes recipient + revoke fields to null', async () => {
    const repo = new InMemorySharesRepository();
    const row = await repo.create(baseInput());
    expect(row.recipientUserId).toBeNull();
    expect(row.revokedAt).toBeNull();
    expect(row.revokedByUserId).toBeNull();
  });

  it('serializes crossOrg as the database string flag', async () => {
    const repo = new InMemorySharesRepository();
    const t = await repo.create(baseInput({ crossOrg: true }));
    const f = await repo.create(baseInput({ crossOrg: false }));
    expect(t.crossOrg).toBe('true');
    expect(f.crossOrg).toBe('false');
  });
});

describe('InMemorySharesRepository.findById', () => {
  it('returns the row when tenantId matches', async () => {
    const repo = new InMemorySharesRepository();
    const created = await repo.create(baseInput());
    expect(await repo.findById(created.id, tenantA)).toEqual(created);
  });

  it('isolates by tenantId — returns null on a foreign tenant', async () => {
    const repo = new InMemorySharesRepository();
    const created = await repo.create(baseInput());
    expect(await repo.findById(created.id, tenantB)).toBeNull();
  });

  it('returns null on an unknown id', async () => {
    const repo = new InMemorySharesRepository();
    expect(await repo.findById(randomUUID(), tenantA)).toBeNull();
  });
});

describe('InMemorySharesRepository.findByMeetingId', () => {
  it('returns every row matching meeting + tenant', async () => {
    const repo = new InMemorySharesRepository();
    const meetingId = randomUUID();
    await repo.create(baseInput({ meetingId }));
    await repo.create(baseInput({ meetingId }));
    await repo.create(baseInput({ meetingId: randomUUID() }));
    const rows = await repo.findByMeetingId(meetingId, tenantA);
    expect(rows).toHaveLength(2);
  });

  it('isolates by tenantId', async () => {
    const repo = new InMemorySharesRepository();
    const meetingId = randomUUID();
    await repo.create(baseInput({ meetingId }));
    expect(await repo.findByMeetingId(meetingId, tenantB)).toEqual([]);
  });

  it('returns empty when no shares exist for the meeting', async () => {
    const repo = new InMemorySharesRepository();
    expect(await repo.findByMeetingId(randomUUID(), tenantA)).toEqual([]);
  });
});

describe('InMemorySharesRepository.findByTokenHash', () => {
  it('returns the row when tokenHash matches', async () => {
    const repo = new InMemorySharesRepository();
    const created = await repo.create(baseInput({ tokenHash: 'abc-hash', kind: 'token-url' }));
    expect(await repo.findByTokenHash('abc-hash')).toEqual(created);
  });

  it('skips revoked rows', async () => {
    const repo = new InMemorySharesRepository();
    const created = await repo.create(baseInput({ tokenHash: 'abc-hash', kind: 'token-url' }));
    await repo.revoke(created.id, tenantA, userA);
    expect(await repo.findByTokenHash('abc-hash')).toBeNull();
  });

  it('returns null on an unknown hash', async () => {
    const repo = new InMemorySharesRepository();
    expect(await repo.findByTokenHash('nope')).toBeNull();
  });
});

describe('InMemorySharesRepository.revoke', () => {
  it('marks the row as revoked with timestamp + actor', async () => {
    const repo = new InMemorySharesRepository();
    const created = await repo.create(baseInput());
    const revoked = await repo.revoke(created.id, tenantA, userB);
    expect(revoked?.revokedAt).toBeInstanceOf(Date);
    expect(revoked?.revokedByUserId).toBe(userB);
  });

  it('returns null when the row belongs to a different tenant', async () => {
    const repo = new InMemorySharesRepository();
    const created = await repo.create(baseInput());
    expect(await repo.revoke(created.id, tenantB, userA)).toBeNull();
  });

  it('returns null when the row is already revoked', async () => {
    const repo = new InMemorySharesRepository();
    const created = await repo.create(baseInput());
    await repo.revoke(created.id, tenantA, userA);
    expect(await repo.revoke(created.id, tenantA, userA)).toBeNull();
  });

  it('returns null on an unknown id', async () => {
    const repo = new InMemorySharesRepository();
    expect(await repo.revoke(randomUUID(), tenantA, userA)).toBeNull();
  });
});

describe('InMemorySharesRepository.resolveRecipient', () => {
  it('sets recipientUserId on the row', async () => {
    const repo = new InMemorySharesRepository();
    const created = await repo.create(baseInput());
    await repo.resolveRecipient(created.id, userB);
    const updated = await repo.findById(created.id, tenantA);
    expect(updated?.recipientUserId).toBe(userB);
  });

  it('is a no-op on an unknown id', async () => {
    const repo = new InMemorySharesRepository();
    await expect(repo.resolveRecipient(randomUUID(), userB)).resolves.toBeUndefined();
  });
});
