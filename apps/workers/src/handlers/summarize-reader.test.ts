/**
 * Story 3.2 + 3.3 — `DrizzleSummarizeReader` + `formatTranscriptForLlm`
 * unit tests.
 *
 * The reader is a thin Drizzle adapter; we fake the chain
 * `select().from().where().limit()` and `select().from().where().orderBy()`
 * so we can verify the row→DTO mapping + null-handling. The transcript
 * formatter is a pure helper exercised independently.
 */

import type { Db } from '@aisecretary/db';
import { describe, expect, it, vi } from 'vitest';
import { DrizzleSummarizeReader, formatTranscriptForLlm } from './summarize-reader.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const MEETING_ID = '22222222-2222-4222-8222-222222222222';

const buildFakeDb = (responses: ReadonlyArray<Array<Record<string, unknown>>>): Db => {
  let callIndex = 0;
  const next = (): Array<Record<string, unknown>> => {
    const idx = callIndex;
    callIndex += 1;
    return responses[idx] ?? [];
  };
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => next()),
          orderBy: vi.fn(async () => next()),
        })),
      })),
    })),
  } as unknown as Db;
};

describe('DrizzleSummarizeReader.readMeetingWithTurns', () => {
  it('returns null when the meeting is not found', async () => {
    const reader = new DrizzleSummarizeReader(buildFakeDb([[]]));
    expect(await reader.readMeetingWithTurns(MEETING_ID, TENANT_ID)).toBeNull();
  });

  it('returns the meeting + turns when both are present', async () => {
    const startedAt = new Date('2026-04-30T10:00:00Z');
    const reader = new DrizzleSummarizeReader(
      buildFakeDb([
        [
          {
            id: MEETING_ID,
            tenantId: TENANT_ID,
            title: 'Acme — discovery',
            startedAt,
            endedAt: null,
          },
        ],
        [
          {
            turnId: 't-1',
            speaker: 'Priya',
            spanStartMs: 0,
            spanEndMs: 5_000,
            text: 'Welcome.',
            sequence: 0,
          },
        ],
      ]),
    );
    const result = await reader.readMeetingWithTurns(MEETING_ID, TENANT_ID);
    expect(result?.meeting.id).toBe(MEETING_ID);
    expect(result?.turns).toHaveLength(1);
    expect(result?.turns[0]?.speaker).toBe('Priya');
  });

  it('returns an empty turns array for a meeting with no transcript yet', async () => {
    const reader = new DrizzleSummarizeReader(
      buildFakeDb([
        [
          {
            id: MEETING_ID,
            tenantId: TENANT_ID,
            title: 'Pending',
            startedAt: null,
            endedAt: null,
          },
        ],
        [],
      ]),
    );
    const result = await reader.readMeetingWithTurns(MEETING_ID, TENANT_ID);
    expect(result?.turns).toEqual([]);
  });
});

describe('DrizzleSummarizeReader.findTenantById', () => {
  it('returns null when the tenant is not found', async () => {
    const reader = new DrizzleSummarizeReader(buildFakeDb([[]]));
    expect(await reader.findTenantById(TENANT_ID)).toBeNull();
  });

  it('returns tenant with empty compliancePosture when null in DB', async () => {
    const reader = new DrizzleSummarizeReader(
      buildFakeDb([[{ id: TENANT_ID, region: 'us', compliancePosture: null }]]),
    );
    const result = await reader.findTenantById(TENANT_ID);
    expect(result).toEqual({
      id: TENANT_ID,
      region: 'us',
      compliancePosture: {},
    });
  });

  it('preserves compliancePosture when set', async () => {
    const reader = new DrizzleSummarizeReader(
      buildFakeDb([[{ id: TENANT_ID, region: 'eu', compliancePosture: { hipaa: true } }]]),
    );
    const result = await reader.findTenantById(TENANT_ID);
    expect(result?.compliancePosture).toEqual({ hipaa: true });
    expect(result?.region).toBe('eu');
  });
});

describe('formatTranscriptForLlm', () => {
  const startedAt = new Date('2026-04-30T10:00:00.000Z');

  it('returns an empty-transcript marker on no turns', () => {
    const out = formatTranscriptForLlm({ meetingId: MEETING_ID, startedAt, turns: [] });
    expect(out).toContain('(empty transcript');
    expect(out).toContain(MEETING_ID);
  });

  it('renders one line per turn with all citation fields', () => {
    const out = formatTranscriptForLlm({
      meetingId: MEETING_ID,
      startedAt,
      turns: [
        {
          turnId: 't-1',
          speaker: 'Priya',
          spanStartMs: 0,
          spanEndMs: 5_000,
          text: 'Welcome to the call.',
          sequence: 0,
        },
        {
          turnId: 't-2',
          speaker: null,
          spanStartMs: 5_000,
          spanEndMs: 12_000,
          text: 'Thanks for joining.',
          sequence: 1,
        },
      ],
    });
    expect(out).toContain('[turnId=t-1 seq=0 start=0 end=5000 speaker=Priya] Welcome to the call.');
    expect(out).toContain(
      '[turnId=t-2 seq=1 start=5000 end=12000 speaker=null] Thanks for joining.',
    );
  });

  it('renders "STARTED_AT: unknown" when no start timestamp', () => {
    const out = formatTranscriptForLlm({ meetingId: MEETING_ID, startedAt: null, turns: [] });
    expect(out).toContain('STARTED_AT: unknown');
  });

  it('serializes startedAt as ISO 8601', () => {
    const out = formatTranscriptForLlm({ meetingId: MEETING_ID, startedAt, turns: [] });
    expect(out).toContain('STARTED_AT: 2026-04-30T10:00:00.000Z');
  });

  it('joins turns with newlines (not double-newlines)', () => {
    const out = formatTranscriptForLlm({
      meetingId: MEETING_ID,
      startedAt,
      turns: [
        {
          turnId: 't-1',
          speaker: 'A',
          spanStartMs: 0,
          spanEndMs: 1,
          text: 'first',
          sequence: 0,
        },
        {
          turnId: 't-2',
          speaker: 'B',
          spanStartMs: 1,
          spanEndMs: 2,
          text: 'second',
          sequence: 1,
        },
      ],
    });
    // Body should contain both lines on adjacent lines.
    expect(out).toMatch(/first\n\[turnId=t-2/);
  });
});
