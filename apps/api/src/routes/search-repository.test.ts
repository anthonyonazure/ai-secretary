/**
 * Story 7.2 — `InMemorySearchRepository` unit tests.
 *
 * Locks the substring-match + <mark>-wrap snippet contract that
 * mirrors Postgres `ts_headline`. The wire shape is identical to the
 * Drizzle variant so route tests can use either interchangeably.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { InMemorySearchRepository, type InMemorySearchSeed } from './search-repository.js';

const tenantId = randomUUID();

const seed = (overrides: Partial<InMemorySearchSeed> = {}): InMemorySearchSeed => ({
  meetingId: randomUUID(),
  meetingTitle: 'Acme — discovery call',
  turnId: 't-1',
  speaker: 'Priya',
  spanStartMs: 0,
  spanEndMs: 5_000,
  source: 'transcript',
  text: 'Champion confirmed budget through Q4.',
  ...overrides,
});

describe('InMemorySearchRepository.search', () => {
  it('returns hits with <mark>-wrapped snippets', async () => {
    const repo = new InMemorySearchRepository();
    repo.insert(tenantId, seed());
    const result = await repo.search({ tenantId, query: 'budget', limit: 10 });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.snippet).toContain('<mark>budget</mark>');
  });

  it('matches case-insensitively', async () => {
    const repo = new InMemorySearchRepository();
    repo.insert(tenantId, seed({ text: 'BUDGET approved by procurement.' }));
    const result = await repo.search({ tenantId, query: 'budget', limit: 10 });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.snippet).toContain('<mark>BUDGET</mark>');
  });

  it('isolates by tenant', async () => {
    const repo = new InMemorySearchRepository();
    repo.insert(tenantId, seed());
    repo.insert(randomUUID(), seed({ text: 'Champion confirmed budget through Q4.' }));
    const result = await repo.search({ tenantId, query: 'budget', limit: 10 });
    expect(result.hits).toHaveLength(1);
  });

  it('filters by meetingId when provided', async () => {
    const repo = new InMemorySearchRepository();
    const meetingId = randomUUID();
    repo.insert(tenantId, seed({ meetingId, text: 'budget approved' }));
    repo.insert(tenantId, seed({ meetingId: randomUUID(), text: 'budget rejected' }));
    const result = await repo.search({ tenantId, query: 'budget', meetingId, limit: 10 });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.meetingId).toBe(meetingId);
  });

  it('returns rank > 0 only for matching rows', async () => {
    const repo = new InMemorySearchRepository();
    repo.insert(tenantId, seed({ text: 'budget budget budget' }));
    const result = await repo.search({ tenantId, query: 'budget', limit: 10 });
    expect(result.hits[0]?.rank).toBeGreaterThan(0);
  });

  it('sorts by descending rank (more occurrences first)', async () => {
    const repo = new InMemorySearchRepository();
    repo.insert(tenantId, seed({ turnId: 'a', text: 'budget once' }));
    repo.insert(tenantId, seed({ turnId: 'b', text: 'budget budget budget' }));
    const result = await repo.search({ tenantId, query: 'budget', limit: 10 });
    expect(result.hits[0]?.turnId).toBe('b');
    expect(result.hits[1]?.turnId).toBe('a');
  });

  it('caps results at limit but preserves totalCount', async () => {
    const repo = new InMemorySearchRepository();
    for (let i = 0; i < 5; i += 1) {
      repo.insert(tenantId, seed({ turnId: `t-${i}`, text: `budget item ${i}` }));
    }
    const result = await repo.search({ tenantId, query: 'budget', limit: 3 });
    expect(result.hits).toHaveLength(3);
    expect(result.totalCount).toBe(5);
  });

  it('returns empty when nothing matches', async () => {
    const repo = new InMemorySearchRepository();
    repo.insert(tenantId, seed());
    const result = await repo.search({ tenantId, query: 'nonexistent', limit: 10 });
    expect(result.hits).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it('preserves the source field on hits', async () => {
    const repo = new InMemorySearchRepository();
    repo.insert(tenantId, seed({ source: 'meeting-title', text: 'budget review' }));
    const result = await repo.search({ tenantId, query: 'budget', limit: 10 });
    expect(result.hits[0]?.source).toBe('meeting-title');
  });

  it('handles regex-special chars in the query without throwing', async () => {
    const repo = new InMemorySearchRepository();
    repo.insert(tenantId, seed({ text: 'Q4 ($1.2M) budget approved.' }));
    const result = await repo.search({ tenantId, query: '$1.2M', limit: 10 });
    expect(result.hits[0]?.snippet).toContain('<mark>$1.2M</mark>');
  });
});
