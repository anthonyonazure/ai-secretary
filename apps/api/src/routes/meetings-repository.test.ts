/**
 * Story 2.1 follow-up — `InMemoryMeetingsRepository` unit tests.
 *
 * Locks the read-only contracts the meetings routes depend on:
 * speaker-turn ordering, latest-completed-recording lookup, cursor
 * pagination on the meetings list, tenant-scoped storage.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  InMemoryMeetingsRepository,
  type MeetingRecordingRow,
  type MeetingSummaryRow,
  type SpeakerTurnRow,
} from './meetings-repository.js';

const tenantId = randomUUID();

const turn = (overrides: Partial<SpeakerTurnRow> = {}): SpeakerTurnRow => ({
  turnId: 't-1',
  speaker: 'Priya',
  spanStartMs: 0,
  spanEndMs: 5_000,
  text: 'Welcome.',
  confidence: 0.95,
  sequence: 0,
  ...overrides,
});

const recording = (overrides: Partial<MeetingRecordingRow> = {}): MeetingRecordingRow => ({
  id: randomUUID(),
  storageKey: `recordings/${randomUUID()}.m4a`,
  contentType: 'audio/m4a',
  ...overrides,
});

const meetingSummary = (overrides: Partial<MeetingSummaryRow> = {}): MeetingSummaryRow => ({
  id: randomUUID(),
  title: 'Acme — discovery',
  source: 'mobile_recording',
  status: 'analyzed',
  durationSeconds: 1800,
  startedAt: new Date('2026-04-30T10:00:00Z'),
  endedAt: new Date('2026-04-30T10:30:00Z'),
  createdAt: new Date('2026-04-30T10:00:00Z'),
  ...overrides,
});

describe('InMemoryMeetingsRepository.findSpeakerTurnsByMeetingId', () => {
  it('returns turns sorted by sequence regardless of insert order', async () => {
    const repo = new InMemoryMeetingsRepository();
    const meetingId = randomUUID();
    repo.setSpeakerTurns(tenantId, meetingId, [
      turn({ turnId: 'b', sequence: 2 }),
      turn({ turnId: 'a', sequence: 0 }),
      turn({ turnId: 'c', sequence: 1 }),
    ]);
    const result = await repo.findSpeakerTurnsByMeetingId(meetingId, tenantId);
    expect(result.map((t) => t.turnId)).toEqual(['a', 'c', 'b']);
  });

  it('returns an empty array when no turns are seeded', async () => {
    const repo = new InMemoryMeetingsRepository();
    expect(await repo.findSpeakerTurnsByMeetingId(randomUUID(), tenantId)).toEqual([]);
  });

  it('isolates by tenant + meeting key', async () => {
    const repo = new InMemoryMeetingsRepository();
    const meetingId = randomUUID();
    repo.setSpeakerTurns(tenantId, meetingId, [turn()]);
    expect(await repo.findSpeakerTurnsByMeetingId(meetingId, randomUUID())).toEqual([]);
  });
});

describe('InMemoryMeetingsRepository.findLatestCompletedRecordingByMeetingId', () => {
  it('returns the first recording in the seeded list', async () => {
    const repo = new InMemoryMeetingsRepository();
    const meetingId = randomUUID();
    const r = recording({ id: 'first' });
    repo.setRecordings(tenantId, meetingId, [r, recording({ id: 'second' })]);
    const result = await repo.findLatestCompletedRecordingByMeetingId(meetingId, tenantId);
    expect(result?.id).toBe('first');
  });

  it('returns null on no recordings', async () => {
    const repo = new InMemoryMeetingsRepository();
    expect(await repo.findLatestCompletedRecordingByMeetingId(randomUUID(), tenantId)).toBeNull();
  });

  it('isolates by tenant', async () => {
    const repo = new InMemoryMeetingsRepository();
    const meetingId = randomUUID();
    repo.setRecordings(tenantId, meetingId, [recording()]);
    expect(await repo.findLatestCompletedRecordingByMeetingId(meetingId, randomUUID())).toBeNull();
  });
});

describe('InMemoryMeetingsRepository.listMeetings', () => {
  it('returns rows sorted by createdAt DESC', async () => {
    const repo = new InMemoryMeetingsRepository();
    repo.setMeetings(tenantId, [
      meetingSummary({ id: 'a', createdAt: new Date('2026-04-30T10:00:00Z') }),
      meetingSummary({ id: 'b', createdAt: new Date('2026-04-30T13:00:00Z') }),
      meetingSummary({ id: 'c', createdAt: new Date('2026-04-30T11:00:00Z') }),
    ]);
    const result = await repo.listMeetings({ tenantId, limit: 100, cursor: null });
    expect(result.items.map((m) => m.id)).toEqual(['b', 'c', 'a']);
  });

  it('produces a nextCursor when more rows exist', async () => {
    const repo = new InMemoryMeetingsRepository();
    repo.setMeetings(
      tenantId,
      Array.from({ length: 5 }, (_, i) =>
        meetingSummary({ id: `m-${i}`, createdAt: new Date(`2026-04-30T1${i}:00:00Z`) }),
      ),
    );
    const result = await repo.listMeetings({ tenantId, limit: 2, cursor: null });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it('continues pagination via the cursor', async () => {
    const repo = new InMemoryMeetingsRepository();
    repo.setMeetings(
      tenantId,
      Array.from({ length: 5 }, (_, i) =>
        meetingSummary({ id: `m-${i}`, createdAt: new Date(`2026-04-30T1${i}:00:00Z`) }),
      ),
    );
    const page1 = await repo.listMeetings({ tenantId, limit: 2, cursor: null });
    const page2 = await repo.listMeetings({ tenantId, limit: 2, cursor: page1.nextCursor });
    expect(page2.items).toHaveLength(2);
    expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
  });

  it('returns null nextCursor when no more rows', async () => {
    const repo = new InMemoryMeetingsRepository();
    repo.setMeetings(tenantId, [meetingSummary()]);
    const result = await repo.listMeetings({ tenantId, limit: 10, cursor: null });
    expect(result.nextCursor).toBeNull();
  });

  it('isolates by tenant', async () => {
    const repo = new InMemoryMeetingsRepository();
    repo.setMeetings(tenantId, [meetingSummary()]);
    repo.setMeetings(randomUUID(), [meetingSummary(), meetingSummary()]);
    const result = await repo.listMeetings({ tenantId, limit: 100, cursor: null });
    expect(result.items).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it('returns empty when the tenant has no meetings', async () => {
    const repo = new InMemoryMeetingsRepository();
    const result = await repo.listMeetings({ tenantId, limit: 10, cursor: null });
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
  });
});
