import { beforeEach, describe, expect, it } from 'vitest';

import {
  type BotSessionsRepository,
  InMemoryBotSessionsRepository,
  __cursorCodec,
} from './bot-sessions-repository.js';

const tenantA = 'a0000000-0000-0000-0000-000000000001';
const tenantB = 'a0000000-0000-0000-0000-000000000002';
const userA = 'b0000000-0000-0000-0000-000000000001';
const userB = 'b0000000-0000-0000-0000-000000000002';

const make = (): {
  repo: InMemoryBotSessionsRepository;
  asContract: BotSessionsRepository;
} => {
  const repo = new InMemoryBotSessionsRepository();
  return { repo, asContract: repo };
};

describe('InMemoryBotSessionsRepository', () => {
  describe('create', () => {
    it('initializes status=provisioning + null joinedAt/endedAt/failureReason', async () => {
      const { asContract } = make();
      const row = await asContract.create({
        tenantId: tenantA,
        meetingId: null,
        ownerUserId: userA,
        source: 'zoom_bot',
        region: 'us',
        externalMeetingId: '999-000-111',
      });
      expect(row.status).toBe('provisioning');
      expect(row.joinedAt).toBeNull();
      expect(row.endedAt).toBeNull();
      expect(row.failureReason).toBeNull();
      expect(row.tenantId).toBe(tenantA);
    });

    it('honors deterministic id factory + clock for tests', async () => {
      const { repo, asContract } = make();
      repo.idFactory = () => 'sess-fixed';
      repo.now = () => new Date('2026-05-01T00:00:00Z');
      const row = await asContract.create({
        tenantId: tenantA,
        meetingId: null,
        ownerUserId: userA,
        source: 'teams_bot',
        region: 'eu',
        externalMeetingId: 'graph-meeting-123',
      });
      expect(row.id).toBe('sess-fixed');
      expect(row.createdAt.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    });
  });

  describe('findById — tenant isolation', () => {
    it('returns null when the row exists in another tenant', async () => {
      const { asContract } = make();
      const row = await asContract.create({
        tenantId: tenantA,
        meetingId: null,
        ownerUserId: userA,
        source: 'zoom_bot',
        region: 'us',
        externalMeetingId: 'm-1',
      });
      expect(await asContract.findById(row.id, tenantB)).toBeNull();
      expect(await asContract.findById(row.id, tenantA)).not.toBeNull();
    });

    it('returns a copy — caller cannot mutate internal state', async () => {
      const { asContract } = make();
      const created = await asContract.create({
        tenantId: tenantA,
        meetingId: null,
        ownerUserId: userA,
        source: 'zoom_bot',
        region: 'us',
        externalMeetingId: 'm-1',
      });
      const fetched = await asContract.findById(created.id, tenantA);
      expect(fetched).not.toBeNull();
      if (!fetched) return;
      fetched.status = 'failed';
      const refetched = await asContract.findById(created.id, tenantA);
      expect(refetched?.status).toBe('provisioning');
    });
  });

  describe('update', () => {
    it('applies a patch and stamps updatedAt', async () => {
      const { repo, asContract } = make();
      let tick = new Date('2026-05-01T00:00:00Z').getTime();
      repo.now = () => {
        tick += 1000;
        return new Date(tick);
      };
      const row = await asContract.create({
        tenantId: tenantA,
        meetingId: null,
        ownerUserId: userA,
        source: 'zoom_bot',
        region: 'us',
        externalMeetingId: 'm-1',
      });
      const joinedAt = new Date('2026-05-01T00:01:00Z');
      const updated = await asContract.update(row.id, tenantA, {
        status: 'joined',
        joinedAt,
      });
      expect(updated?.status).toBe('joined');
      expect(updated?.joinedAt).toEqual(joinedAt);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime());
    });

    it('returns null when the row is in a different tenant', async () => {
      const { asContract } = make();
      const row = await asContract.create({
        tenantId: tenantA,
        meetingId: null,
        ownerUserId: userA,
        source: 'zoom_bot',
        region: 'us',
        externalMeetingId: 'm-1',
      });
      const result = await asContract.update(row.id, tenantB, { status: 'failed' });
      expect(result).toBeNull();
    });

    it('treats missing patch fields as untouched, including explicit nulls', async () => {
      const { asContract } = make();
      const row = await asContract.create({
        tenantId: tenantA,
        meetingId: null,
        ownerUserId: userA,
        source: 'zoom_bot',
        region: 'us',
        externalMeetingId: 'm-1',
      });
      // Explicit null clears failureReason. Omitted field leaves it.
      await asContract.update(row.id, tenantA, { failureReason: 'oops' });
      const after1 = await asContract.findById(row.id, tenantA);
      expect(after1?.failureReason).toBe('oops');
      await asContract.update(row.id, tenantA, { status: 'failed' });
      const after2 = await asContract.findById(row.id, tenantA);
      expect(after2?.failureReason).toBe('oops');
      await asContract.update(row.id, tenantA, { failureReason: null });
      const after3 = await asContract.findById(row.id, tenantA);
      expect(after3?.failureReason).toBeNull();
    });
  });

  describe('list — tenant isolation + cursor pagination', () => {
    let repo: InMemoryBotSessionsRepository;
    let asContract: BotSessionsRepository;

    beforeEach(async () => {
      const m = make();
      repo = m.repo;
      asContract = m.asContract;
      let tick = new Date('2026-05-01T00:00:00Z').getTime();
      repo.now = () => {
        tick += 60_000;
        return new Date(tick);
      };
      let n = 0;
      repo.idFactory = () => {
        n += 1;
        return `sess-${n.toString().padStart(3, '0')}`;
      };
      // 5 sessions in tenantA — first 3 owned by userA, last 2 by userB.
      for (let i = 0; i < 3; i += 1) {
        await asContract.create({
          tenantId: tenantA,
          meetingId: i === 0 ? 'meeting-1' : null,
          ownerUserId: userA,
          source: 'zoom_bot',
          region: 'us',
          externalMeetingId: `m-${i}`,
        });
      }
      for (let i = 0; i < 2; i += 1) {
        await asContract.create({
          tenantId: tenantA,
          meetingId: null,
          ownerUserId: userB,
          source: 'teams_bot',
          region: 'us',
          externalMeetingId: `t-${i}`,
        });
      }
      // 1 session in tenantB — must NOT appear in tenantA's list.
      await asContract.create({
        tenantId: tenantB,
        meetingId: null,
        ownerUserId: userA,
        source: 'zoom_bot',
        region: 'us',
        externalMeetingId: 'leak-test',
      });
    });

    it('lists tenantA sessions only, in createdAt-DESC order', async () => {
      const result = await asContract.list({
        tenantId: tenantA,
        limit: 10,
        cursor: null,
      });
      expect(result.items).toHaveLength(5);
      expect(result.totalCount).toBe(5);
      expect(result.nextCursor).toBeNull();
      // No tenantB rows leaked.
      expect(result.items.every((r) => r.tenantId === tenantA)).toBe(true);
      // Sorted DESC.
      for (let i = 1; i < result.items.length; i += 1) {
        const prev = result.items[i - 1];
        const curr = result.items[i];
        if (!prev || !curr) throw new Error('unreachable');
        expect(prev.createdAt.getTime()).toBeGreaterThanOrEqual(curr.createdAt.getTime());
      }
    });

    it('paginates via opaque cursor and reports totalCount on every page', async () => {
      const page1 = await asContract.list({ tenantId: tenantA, limit: 2, cursor: null });
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).not.toBeNull();
      expect(page1.totalCount).toBe(5);

      const page2 = await asContract.list({
        tenantId: tenantA,
        limit: 2,
        cursor: page1.nextCursor,
      });
      expect(page2.items).toHaveLength(2);
      expect(page2.nextCursor).not.toBeNull();
      expect(page2.totalCount).toBe(5);

      const page3 = await asContract.list({
        tenantId: tenantA,
        limit: 2,
        cursor: page2.nextCursor,
      });
      expect(page3.items).toHaveLength(1);
      expect(page3.nextCursor).toBeNull();

      // No id appears across more than one page.
      const ids = [...page1.items, ...page2.items, ...page3.items].map((r) => r.id);
      expect(new Set(ids).size).toBe(5);
    });

    it('filters by ownerUserId', async () => {
      const result = await asContract.list({
        tenantId: tenantA,
        ownerUserId: userA,
        limit: 10,
        cursor: null,
      });
      expect(result.items).toHaveLength(3);
      expect(result.items.every((r) => r.ownerUserId === userA)).toBe(true);
      expect(result.totalCount).toBe(3);
    });

    it('filters by meetingId', async () => {
      const result = await asContract.list({
        tenantId: tenantA,
        meetingId: 'meeting-1',
        limit: 10,
        cursor: null,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.meetingId).toBe('meeting-1');
    });

    it('rejects malformed cursor by treating it as null (no crash)', async () => {
      const result = await asContract.list({
        tenantId: tenantA,
        limit: 10,
        cursor: 'not-a-real-cursor',
      });
      expect(result.items).toHaveLength(5);
    });
  });

  describe('cursor codec', () => {
    it('round-trips createdAt + id', () => {
      const at = new Date('2026-05-01T01:23:45.678Z');
      const id = '11111111-2222-3333-4444-555555555555';
      const encoded = __cursorCodec.encode(at, id);
      const decoded = __cursorCodec.decode(encoded);
      expect(decoded?.createdAt.toISOString()).toBe(at.toISOString());
      expect(decoded?.id).toBe(id);
    });

    it('returns null for malformed input', () => {
      expect(__cursorCodec.decode('garbage')).toBeNull();
      expect(__cursorCodec.decode(null)).toBeNull();
    });
  });
});
