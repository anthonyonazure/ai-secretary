import { randomUUID } from 'node:crypto';
import type { Db } from '@aisecretary/db';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { type EmbeddingProvider, createIndexEmbeddingsHandler } from './index-embeddings.js';

const buildFakeDb = (input: {
  turns: Array<{ turnId: string; speaker: string | null; text: string }>;
}): Db & { __getInserted: () => unknown[] } => {
  const inserted: unknown[] = [];
  const txStub = {
    execute: vi.fn(async () => undefined),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => input.turns),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((rows: unknown) => {
        return {
          onConflictDoUpdate: vi.fn(async () => {
            if (Array.isArray(rows)) inserted.push(...rows);
            else inserted.push(rows);
          }),
        };
      }),
    })),
  };
  return {
    select: vi.fn(() => txStub.select()),
    transaction: vi.fn(async (cb: (tx: typeof txStub) => Promise<unknown>) => cb(txStub)),
    __getInserted: () => inserted,
  } as unknown as Db & { __getInserted: () => unknown[] };
};

const buildEmbeddingProvider = (dimension: 1024 | 1536 = 1536): EmbeddingProvider => ({
  modelId: dimension === 1536 ? 'text-embedding-3-small' : 'voyage-2',
  dimension,
  embed: async ({ texts }) =>
    texts.map((_, i) =>
      Array(dimension)
        .fill(0)
        .map((_, d) => ((i + d) % 7) / 7),
    ),
});

describe('index-embeddings handler', () => {
  it('rejects an invalid payload', async () => {
    const handler = createIndexEmbeddingsHandler({
      db: buildFakeDb({ turns: [] }),
      logger: pino({ level: 'silent' }),
      embeddingProvider: buildEmbeddingProvider(),
    });
    await expect(
      handler({ data: { meetingId: 'not-a-uuid', tenantId: 'no', region: 'us' } as never }),
    ).rejects.toThrow(/invalid payload/);
  });

  it('skips meetings with zero speaker_turns', async () => {
    const db = buildFakeDb({ turns: [] });
    const handler = createIndexEmbeddingsHandler({
      db,
      logger: pino({ level: 'silent' }),
      embeddingProvider: buildEmbeddingProvider(),
    });
    await handler({
      data: { meetingId: randomUUID(), tenantId: randomUUID(), region: 'us' },
    });
    expect(db.__getInserted()).toEqual([]);
  });

  it('chunks long turns and inserts one row per chunk', async () => {
    const longText = `${'A'.repeat(2500)}. ${'B'.repeat(2500)}.`;
    const db = buildFakeDb({
      turns: [{ turnId: 'turn-1', speaker: 'Anthony', text: longText }],
    });
    const handler = createIndexEmbeddingsHandler({
      db,
      logger: pino({ level: 'silent' }),
      embeddingProvider: buildEmbeddingProvider(),
    });
    await handler({
      data: { meetingId: randomUUID(), tenantId: randomUUID(), region: 'us' },
    });
    const inserted = db.__getInserted() as Array<{ chunkKey: string; modelId: string }>;
    expect(inserted.length).toBeGreaterThanOrEqual(2);
    expect(inserted.every((r) => r.modelId === 'text-embedding-3-small')).toBe(true);
    expect(inserted.map((r) => r.chunkKey)).toContain('turn-1:0');
  });

  it('keeps a short turn as a single chunk', async () => {
    const db = buildFakeDb({
      turns: [{ turnId: 'turn-2', speaker: null, text: 'hello world' }],
    });
    const handler = createIndexEmbeddingsHandler({
      db,
      logger: pino({ level: 'silent' }),
      embeddingProvider: buildEmbeddingProvider(),
    });
    await handler({
      data: { meetingId: randomUUID(), tenantId: randomUUID(), region: 'us' },
    });
    const inserted = db.__getInserted() as Array<{ chunkKey: string; sourceText: string }>;
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.chunkKey).toBe('turn-2:0');
    expect(inserted[0]?.sourceText).toBe('hello world');
  });

  it('throws when the provider returns the wrong number of vectors', async () => {
    const db = buildFakeDb({
      turns: [
        { turnId: 'turn-1', speaker: null, text: 'a' },
        { turnId: 'turn-2', speaker: null, text: 'b' },
      ],
    });
    const provider: EmbeddingProvider = {
      modelId: 'broken',
      dimension: 1536,
      embed: async () => [Array(1536).fill(0)],
    };
    const handler = createIndexEmbeddingsHandler({
      db,
      logger: pino({ level: 'silent' }),
      embeddingProvider: provider,
    });
    await expect(
      handler({
        data: { meetingId: randomUUID(), tenantId: randomUUID(), region: 'us' },
      }),
    ).rejects.toThrow(/provider returned 1 vectors for 2 chunks/);
  });
});
