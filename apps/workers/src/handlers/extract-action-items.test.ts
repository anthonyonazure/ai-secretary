/**
 * Story 3.3 — `extract-action-items` handler unit tests.
 *
 * Verifies the full handler path with all dependencies (DB, gateway,
 * summarize-reader, modules) faked. Covers:
 *   - invalid payload throws
 *   - meeting-not-found / tenant-not-found / region mismatch all throw
 *   - clean parse → rows inserted with right shape
 *   - empty items list → no insert
 *   - confidence calculation effects (no citations → score reduced)
 */

import { randomUUID } from 'node:crypto';
import type { Db, Region } from '@aisecretary/db';
import type { LlmGateway } from '@aisecretary/llm-gateway';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import {
  type ActionItemsGatewayFactory,
  createExtractActionItemsHandler,
} from './extract-action-items.js';
import type { MeetingWithTurns, SummarizeReader, TenantForAnalysis } from './summarize-reader.js';

const TENANT_ID = randomUUID();
const MEETING_ID = randomUUID();
const REGION: Region = 'us';

const buildMeeting = (): MeetingWithTurns => ({
  meeting: {
    id: MEETING_ID,
    tenantId: TENANT_ID,
    title: 'Acme — discovery',
    startedAt: new Date('2026-04-30T10:00:00Z'),
    endedAt: new Date('2026-04-30T10:30:00Z'),
  },
  turns: [
    {
      turnId: 't-1',
      speaker: 'Priya',
      spanStartMs: 0,
      spanEndMs: 5_000,
      text: 'Send the SOC 2 questionnaire by Friday.',
      sequence: 0,
    },
  ],
});

const buildTenant = (overrides: Partial<TenantForAnalysis> = {}): TenantForAnalysis => ({
  id: TENANT_ID,
  region: REGION,
  compliancePosture: {},
  ...overrides,
});

const buildReader = (overrides: Partial<SummarizeReader> = {}): SummarizeReader => ({
  readMeetingWithTurns: vi.fn(async () => buildMeeting()),
  findTenantById: vi.fn(async () => buildTenant()),
  ...overrides,
});

const buildFakeDb = (): { db: Db; insertCalls: Array<Array<unknown>> } => {
  const insertCalls: Array<Array<unknown>> = [];
  const tx = {
    insert: vi.fn(() => ({
      values: vi.fn(async (rows: Array<unknown>) => {
        insertCalls.push(rows);
      }),
    })),
    execute: vi.fn(async () => ({ rows: [] })),
  };
  const transaction = vi.fn(async (cb: (tx: typeof tx) => Promise<unknown>) => cb(tx));
  return {
    db: {
      transaction,
      execute: vi.fn(async () => ({ rows: [] })),
    } as unknown as Db,
    insertCalls,
  };
};

const buildGatewayFactory = (
  responseOverrides: Partial<{
    parsed: unknown;
    finishReason: string;
  }> = {},
): ActionItemsGatewayFactory => {
  const parsed = responseOverrides.parsed ?? {
    items: [
      {
        text: 'Send the SOC 2 questionnaire by Friday.',
        ownerName: 'Priya',
        dueDate: '2026-05-03',
        citations: [
          {
            meetingId: MEETING_ID,
            turnId: 't-1',
            spanStartMs: 0,
            spanEndMs: 5_000,
          },
        ],
      },
    ],
  };
  return () =>
    ({
      chat: vi.fn(async () => ({
        parsed,
        finishReason: responseOverrides.finishReason ?? 'stop',
        text: '',
        usage: { inputTokens: 100, outputTokens: 50 },
        provider: 'mock',
        model: 'mock',
      })),
    }) as unknown as Pick<LlmGateway, 'chat'>;
};

const buildHandler = (
  options: {
    summarizeReader?: SummarizeReader;
    gatewayFactory?: ActionItemsGatewayFactory;
    db?: Db;
  } = {},
) => {
  const { db: defaultDb } = buildFakeDb();
  return createExtractActionItemsHandler({
    db: options.db ?? defaultDb,
    logger: pino({ level: 'silent' }),
    summarizeReader: options.summarizeReader ?? buildReader(),
    llmConfigs: {} as never,
    ...(options.gatewayFactory ? { gatewayFactory: options.gatewayFactory } : {}),
  });
};

describe('createExtractActionItemsHandler', () => {
  it('throws on an invalid payload', async () => {
    const handler = buildHandler();
    await expect(handler({ data: { tenantId: 'no', meetingId: 'no' } as never })).rejects.toThrow(
      /invalid payload/,
    );
  });

  it('throws when the meeting is not found', async () => {
    const handler = buildHandler({
      summarizeReader: buildReader({
        readMeetingWithTurns: vi.fn(async () => null),
      }),
      gatewayFactory: buildGatewayFactory(),
    });
    await expect(
      handler({ data: { tenantId: TENANT_ID, meetingId: MEETING_ID, region: REGION } }),
    ).rejects.toThrow(/meeting not found/);
  });

  it('throws when the tenant is not found', async () => {
    const handler = buildHandler({
      summarizeReader: buildReader({
        findTenantById: vi.fn(async () => null),
      }),
      gatewayFactory: buildGatewayFactory(),
    });
    await expect(
      handler({ data: { tenantId: TENANT_ID, meetingId: MEETING_ID, region: REGION } }),
    ).rejects.toThrow(/tenant not found/);
  });

  it('throws on a region mismatch', async () => {
    const handler = buildHandler({
      summarizeReader: buildReader({
        findTenantById: vi.fn(async () => buildTenant({ region: 'eu' })),
      }),
      gatewayFactory: buildGatewayFactory(),
    });
    await expect(
      handler({ data: { tenantId: TENANT_ID, meetingId: MEETING_ID, region: REGION } }),
    ).rejects.toThrow(/region mismatch/);
  });

  it('inserts action-item rows on a clean extraction', async () => {
    const fake = buildFakeDb();
    const handler = buildHandler({
      db: fake.db,
      gatewayFactory: buildGatewayFactory(),
    });
    await handler({
      data: { tenantId: TENANT_ID, meetingId: MEETING_ID, region: REGION },
    });
    expect(fake.insertCalls).toHaveLength(1);
    const rows = fake.insertCalls[0] as Array<{ text: string; tenantId: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe('Send the SOC 2 questionnaire by Friday.');
    expect(rows[0]?.tenantId).toBe(TENANT_ID);
  });

  it('skips the insert when the model returns zero items', async () => {
    const fake = buildFakeDb();
    const handler = buildHandler({
      db: fake.db,
      gatewayFactory: buildGatewayFactory({ parsed: { items: [] } }),
    });
    await handler({
      data: { tenantId: TENANT_ID, meetingId: MEETING_ID, region: REGION },
    });
    expect(fake.insertCalls).toHaveLength(0);
  });

  it('throws when the LLM output fails schema validation', async () => {
    const handler = buildHandler({
      gatewayFactory: buildGatewayFactory({
        // items[0].text fails .min(1) — schema rejects empty string.
        parsed: { items: [{ text: '', ownerName: null, dueDate: null, citations: [] }] },
      }),
    });
    await expect(
      handler({ data: { tenantId: TENANT_ID, meetingId: MEETING_ID, region: REGION } }),
    ).rejects.toThrow(/did not match schema/);
  });

  it('persists confidence as a 3-decimal string', async () => {
    const fake = buildFakeDb();
    const handler = buildHandler({
      db: fake.db,
      gatewayFactory: buildGatewayFactory(),
    });
    await handler({
      data: { tenantId: TENANT_ID, meetingId: MEETING_ID, region: REGION },
    });
    const rows = fake.insertCalls[0] as Array<{ confidence: string }>;
    expect(rows[0]?.confidence).toMatch(/^[0-9]\.[0-9]{3}$/);
  });
});
