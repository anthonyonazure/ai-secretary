/**
 * Story 8.5 — `InMemoryActionItemsRepository` unit tests.
 *
 * Locks the cursor-pagination, filter, and lifecycle-FSM behaviors that
 * the My Actions surface depends on. The same cursor encoding +
 * tenant-isolation invariants live in the Drizzle repo.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  type ActionItemListRow,
  ActionItemNotFoundError,
  InMemoryActionItemsRepository,
} from './action-items-repository.js';

const tenantId = randomUUID();

const buildRow = (overrides: Partial<ActionItemListRow> = {}): ActionItemListRow => ({
  id: randomUUID(),
  meetingId: randomUUID(),
  meetingTitle: 'Acme — discovery',
  meetingRecordedAt: null,
  text: 'Send the SOC 2 questionnaire by Friday.',
  ownerName: 'Priya',
  ownerUserId: null,
  dueDate: null,
  status: 'pending',
  confidence: 0.92,
  citations: [],
  createdAt: new Date('2026-04-30T10:00:00Z'),
  updatedAt: new Date('2026-04-30T10:00:00Z'),
  ...overrides,
});

describe('InMemoryActionItemsRepository.list', () => {
  it('returns rows for the requested tenant only', async () => {
    const repo = new InMemoryActionItemsRepository();
    repo.insert(tenantId, buildRow());
    repo.insert(randomUUID(), buildRow());
    const result = await repo.list({ tenantId, cursor: null, limit: 100 });
    expect(result.items).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it('filters by status array', async () => {
    const repo = new InMemoryActionItemsRepository();
    repo.insert(tenantId, buildRow({ status: 'pending' }));
    repo.insert(tenantId, buildRow({ status: 'done' }));
    repo.insert(tenantId, buildRow({ status: 'accepted' }));
    const result = await repo.list({
      tenantId,
      status: ['pending', 'accepted'],
      cursor: null,
      limit: 100,
    });
    expect(result.items.map((r) => r.status).sort()).toEqual(['accepted', 'pending']);
  });

  it('filters by meetingId', async () => {
    const repo = new InMemoryActionItemsRepository();
    const meetingId = randomUUID();
    repo.insert(tenantId, buildRow({ meetingId }));
    repo.insert(tenantId, buildRow({ meetingId: randomUUID() }));
    const result = await repo.list({ tenantId, meetingId, cursor: null, limit: 100 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.meetingId).toBe(meetingId);
  });

  it('filters by dueBefore (only items with a date)', async () => {
    const repo = new InMemoryActionItemsRepository();
    repo.insert(tenantId, buildRow({ dueDate: new Date('2026-05-01T00:00:00Z') }));
    repo.insert(tenantId, buildRow({ dueDate: new Date('2026-05-10T00:00:00Z') }));
    repo.insert(tenantId, buildRow({ dueDate: null }));
    const result = await repo.list({
      tenantId,
      dueBefore: new Date('2026-05-05T00:00:00Z'),
      cursor: null,
      limit: 100,
    });
    expect(result.items).toHaveLength(1);
  });

  it('sorts results newest-first by updatedAt', async () => {
    const repo = new InMemoryActionItemsRepository();
    repo.insert(tenantId, buildRow({ id: 'a', updatedAt: new Date('2026-04-30T10:00:00Z') }));
    repo.insert(tenantId, buildRow({ id: 'b', updatedAt: new Date('2026-04-30T13:00:00Z') }));
    repo.insert(tenantId, buildRow({ id: 'c', updatedAt: new Date('2026-04-30T11:00:00Z') }));
    const result = await repo.list({ tenantId, cursor: null, limit: 100 });
    expect(result.items.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('returns a nextCursor when more rows exist than limit', async () => {
    const repo = new InMemoryActionItemsRepository();
    for (let i = 0; i < 5; i += 1) {
      repo.insert(
        tenantId,
        buildRow({
          id: String(i),
          updatedAt: new Date(`2026-04-30T1${i}:00:00Z`),
        }),
      );
    }
    const result = await repo.list({ tenantId, cursor: null, limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it('continues pagination via the nextCursor', async () => {
    const repo = new InMemoryActionItemsRepository();
    for (let i = 0; i < 5; i += 1) {
      repo.insert(
        tenantId,
        buildRow({
          id: String(i),
          updatedAt: new Date(`2026-04-30T1${i}:00:00Z`),
        }),
      );
    }
    const page1 = await repo.list({ tenantId, cursor: null, limit: 2 });
    const page2 = await repo.list({ tenantId, cursor: page1.nextCursor, limit: 2 });
    expect(page2.items).toHaveLength(2);
    expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
  });

  it('returns null nextCursor when no more rows', async () => {
    const repo = new InMemoryActionItemsRepository();
    repo.insert(tenantId, buildRow());
    const result = await repo.list({ tenantId, cursor: null, limit: 10 });
    expect(result.nextCursor).toBeNull();
  });
});

describe('InMemoryActionItemsRepository.updateStatus', () => {
  it('updates the row status + bumps updatedAt', async () => {
    const repo = new InMemoryActionItemsRepository();
    const id = randomUUID();
    const original = new Date('2026-04-30T10:00:00Z');
    repo.insert(tenantId, buildRow({ id, status: 'pending', updatedAt: original }));
    const updated = await repo.updateStatus({ tenantId, id, status: 'done' });
    expect(updated.status).toBe('done');
    expect(updated.updatedAt.getTime()).toBeGreaterThan(original.getTime());
  });

  it('throws ActionItemNotFoundError on unknown id', async () => {
    const repo = new InMemoryActionItemsRepository();
    await expect(
      repo.updateStatus({ tenantId, id: randomUUID(), status: 'done' }),
    ).rejects.toBeInstanceOf(ActionItemNotFoundError);
  });

  it('refuses to update a row owned by another tenant', async () => {
    const repo = new InMemoryActionItemsRepository();
    const id = randomUUID();
    repo.insert(randomUUID(), buildRow({ id }));
    await expect(repo.updateStatus({ tenantId, id, status: 'done' })).rejects.toBeInstanceOf(
      ActionItemNotFoundError,
    );
  });
});
