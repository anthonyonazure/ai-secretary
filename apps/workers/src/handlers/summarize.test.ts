/**
 * Story 3.2 — `summarize` handler unit tests.
 *
 * Verifies the full handler path with all dependencies (DB, gateway,
 * summarize-reader, modules) faked. Covers the same precondition path
 * as `extract-action-items` plus the upsert-on-conflict shape that
 * keeps re-runs idempotent.
 */

import { randomUUID } from 'node:crypto';
import type { Db, Region } from '@aisecretary/db';
import type { LlmGateway } from '@aisecretary/llm-gateway';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import type { MeetingWithTurns, SummarizeReader, TenantForAnalysis } from './summarize-reader.js';
import { type SummarizeGatewayFactory, createSummarizeHandler } from './summarize.js';

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
      text: 'Welcome to the discovery call.',
      sequence: 0,
    },
    {
      turnId: 't-2',
      speaker: 'Sam',
      spanStartMs: 5_000,
      spanEndMs: 12_000,
      text: 'Champion confirmed budget through Q4.',
      sequence: 1,
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

const buildFakeDb = (): {
  db: Db;
  insertCalls: Array<unknown>;
  upsertCalls: Array<unknown>;
} => {
  const insertCalls: Array<unknown> = [];
  const upsertCalls: Array<unknown> = [];
  const tx = {
    insert: vi.fn(() => ({
      values: vi.fn((row: unknown) => {
        insertCalls.push(row);
        return {
          onConflictDoUpdate: vi.fn(async (cfg: unknown) => {
            upsertCalls.push(cfg);
          }),
        };
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
    upsertCalls,
  };
};

const buildGatewayFactory = (
  responseOverrides: { parsed?: unknown; finishReason?: string; inputTokens?: number } = {},
): SummarizeGatewayFactory => {
  const parsed =
    'parsed' in responseOverrides
      ? responseOverrides.parsed
      : {
          module: 'general',
          title: 'Quick read',
          summary: 'A 22-minute discovery call.',
          bullets: [
            {
              claim: 'Champion confirmed budget through Q4.',
              citations: [
                { meetingId: MEETING_ID, turnId: 't-2', spanStartMs: 5_000, spanEndMs: 12_000 },
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
        inputTokens: responseOverrides.inputTokens ?? 700,
        outputTokens: 80,
        provider: 'mock',
        model: 'mock',
      })),
    }) as unknown as Pick<LlmGateway, 'chat'>;
};

const buildHandler = (
  options: {
    summarizeReader?: SummarizeReader;
    gatewayFactory?: SummarizeGatewayFactory;
    db?: Db;
  } = {},
) => {
  const fake = buildFakeDb();
  return createSummarizeHandler({
    db: options.db ?? fake.db,
    logger: pino({ level: 'silent' }),
    summarizeReader: options.summarizeReader ?? buildReader(),
    llmConfigs: {} as never,
    ...(options.gatewayFactory ? { gatewayFactory: options.gatewayFactory } : {}),
  });
};

describe('createSummarizeHandler', () => {
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

  it('throws when the LLM returned a non-general module shape', async () => {
    const handler = buildHandler({
      gatewayFactory: buildGatewayFactory({ parsed: { module: 'sales' } }),
    });
    await expect(
      handler({ data: { tenantId: TENANT_ID, meetingId: MEETING_ID, region: REGION } }),
    ).rejects.toThrow(/no parsed output/);
  });

  it('throws when the gateway returns no parsed output at all', async () => {
    const handler = buildHandler({
      gatewayFactory: buildGatewayFactory({ parsed: undefined }),
    });
    await expect(
      handler({ data: { tenantId: TENANT_ID, meetingId: MEETING_ID, region: REGION } }),
    ).rejects.toThrow(/no parsed output/);
  });

  it('upserts the module_outputs row on a clean response', async () => {
    const fake = buildFakeDb();
    const handler = buildHandler({ db: fake.db, gatewayFactory: buildGatewayFactory() });
    await handler({
      data: { tenantId: TENANT_ID, meetingId: MEETING_ID, region: REGION },
    });
    expect(fake.insertCalls).toHaveLength(1);
    expect(fake.upsertCalls).toHaveLength(1);
    const inserted = fake.insertCalls[0] as { tenantId: string; moduleId: string };
    expect(inserted.tenantId).toBe(TENANT_ID);
    expect(inserted.moduleId).toBe('general');
  });

  it('persists confidence as a 3-decimal string', async () => {
    const fake = buildFakeDb();
    const handler = buildHandler({ db: fake.db, gatewayFactory: buildGatewayFactory() });
    await handler({
      data: { tenantId: TENANT_ID, meetingId: MEETING_ID, region: REGION },
    });
    const inserted = fake.insertCalls[0] as { confidence: string };
    expect(inserted.confidence).toMatch(/^[0-9]\.[0-9]{3}$/);
  });
});
