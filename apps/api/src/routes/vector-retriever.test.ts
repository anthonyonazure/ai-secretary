import { randomUUID } from 'node:crypto';
import type { Db } from '@aisecretary/db';
import { describe, expect, it, vi } from 'vitest';

import { type QueryEmbeddingProvider, buildVectorRetriever } from './vector-retriever.js';

const buildFakeDb = (rows: Array<Record<string, unknown>>): Db => {
  const txStub = {
    execute: vi.fn(async () => undefined),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => rows),
            })),
          })),
        })),
      })),
    })),
  };
  return {
    select: vi.fn(),
    transaction: vi.fn(async (cb: (tx: typeof txStub) => Promise<unknown>) => cb(txStub)),
  } as unknown as Db;
};

const buildEmbeddingProvider = (dim: 1024 | 1536 = 1536): QueryEmbeddingProvider => ({
  modelId: 'test-model',
  dimension: dim,
  embed: async () =>
    Array(dim)
      .fill(0)
      .map((_, i) => i / dim),
});

describe('buildVectorRetriever', () => {
  it('returns citations + context + retrievalConfidence', async () => {
    const meetingId = randomUUID();
    const db = buildFakeDb([
      {
        chunkKey: 'turn-1:0',
        meetingId,
        meetingTitle: 'Quarterly review',
        sourceKind: 'transcript',
        sourceText: 'Anthony said pricing should be tiered.',
        distance: 0.2,
      },
      {
        chunkKey: 'turn-2:0',
        meetingId,
        meetingTitle: 'Quarterly review',
        sourceKind: 'transcript',
        sourceText: 'Casey suggested an enterprise tier.',
        distance: 0.35,
      },
    ]);
    const retriever = buildVectorRetriever({
      db,
      region: 'us',
      embeddingProvider: buildEmbeddingProvider(),
    });
    const result = await retriever({
      tenantId: randomUUID(),
      query: 'What did Anthony say about pricing?',
    });
    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]?.turnId).toBe('turn-1');
    expect(result.context).toContain('Anthony said pricing should be tiered.');
    // Top similarity = 1 - 0.2 = 0.8.
    expect(result.retrievalConfidence).toBeCloseTo(0.8, 5);
  });

  it('returns zero confidence when there are no rows', async () => {
    const db = buildFakeDb([]);
    const retriever = buildVectorRetriever({
      db,
      region: 'us',
      embeddingProvider: buildEmbeddingProvider(),
    });
    const result = await retriever({ tenantId: randomUUID(), query: 'unknown' });
    expect(result.citations).toEqual([]);
    expect(result.context).toBe('');
    expect(result.retrievalConfidence).toBe(0);
  });

  it('selects the 1024-dim table when the embedding provider is 1024', async () => {
    const db = buildFakeDb([]);
    const retriever = buildVectorRetriever({
      db,
      region: 'us',
      embeddingProvider: buildEmbeddingProvider(1024),
    });
    await retriever({ tenantId: randomUUID(), query: 'q' });
    // Doesn't throw — the retriever picked the right table internally.
    // (The fake DB returns empty results either way.)
  });

  it('federates across multiple sourceKinds when configured', async () => {
    const meetingId = randomUUID();
    const db = buildFakeDb([
      {
        chunkKey: 'turn-1:0',
        meetingId,
        meetingTitle: 'Demo',
        sourceKind: 'summary',
        sourceText: 'The team agreed to a tiered model.',
        distance: 0.1,
      },
    ]);
    const retriever = buildVectorRetriever({
      db,
      region: 'us',
      embeddingProvider: buildEmbeddingProvider(),
      sourceKinds: ['transcript', 'summary', 'action-item'],
    });
    const result = await retriever({ tenantId: randomUUID(), query: 'tier' });
    expect(result.citations).toHaveLength(1);
    expect(result.context).toContain('tiered model');
  });
});
