/**
 * Story 12.7 — `InMemoryCrossOrgPolicyRepository` unit tests.
 *
 * Locks the policy state machine: defaults to accept-all, the
 * upsert normalizes the whitelist (lowercased domains, dropped on
 * non-whitelist kinds), and `evaluate` is the source-of-truth
 * acceptance gate at recipient view-time.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { InMemoryCrossOrgPolicyRepository } from './cross-org-policy-repository.js';

const tenantId = randomUUID();

describe('InMemoryCrossOrgPolicyRepository.findByTenantId', () => {
  it('defaults to accept-all when no row exists', async () => {
    const repo = new InMemoryCrossOrgPolicyRepository();
    const row = await repo.findByTenantId(tenantId);
    expect(row.kind).toBe('accept-all');
    expect(row.whitelist).toEqual([]);
  });

  it('returns the upserted row', async () => {
    const repo = new InMemoryCrossOrgPolicyRepository();
    await repo.upsert({ tenantId, kind: 'block-all' });
    const row = await repo.findByTenantId(tenantId);
    expect(row.kind).toBe('block-all');
  });
});

describe('InMemoryCrossOrgPolicyRepository.upsert', () => {
  it('lowercases whitelist domains', async () => {
    const repo = new InMemoryCrossOrgPolicyRepository();
    const row = await repo.upsert({
      tenantId,
      kind: 'whitelist',
      whitelist: ['ACME.com', 'BetaCorp.io'],
    });
    expect(row.whitelist).toEqual(['acme.com', 'betacorp.io']);
  });

  it('drops the whitelist when kind is not "whitelist"', async () => {
    const repo = new InMemoryCrossOrgPolicyRepository();
    const row = await repo.upsert({
      tenantId,
      kind: 'accept-all',
      whitelist: ['acme.com'],
    });
    expect(row.whitelist).toEqual([]);
  });

  it('refreshes updatedAt on every upsert', async () => {
    const repo = new InMemoryCrossOrgPolicyRepository();
    const first = await repo.upsert({ tenantId, kind: 'accept-all' });
    await new Promise((r) => setTimeout(r, 5));
    const second = await repo.upsert({ tenantId, kind: 'block-all' });
    expect(second.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());
  });
});

describe('InMemoryCrossOrgPolicyRepository.evaluate', () => {
  it('returns accept-all by default', async () => {
    const repo = new InMemoryCrossOrgPolicyRepository();
    const r = await repo.evaluate({ tenantId, senderDomain: 'evil.test' });
    expect(r).toEqual({ accepted: true, reason: 'accept-all' });
  });

  it('returns block-all when policy is block-all', async () => {
    const repo = new InMemoryCrossOrgPolicyRepository();
    await repo.upsert({ tenantId, kind: 'block-all' });
    const r = await repo.evaluate({ tenantId, senderDomain: 'acme.test' });
    expect(r).toEqual({ accepted: false, reason: 'block-all' });
  });

  it('returns whitelist-match for an allowed domain', async () => {
    const repo = new InMemoryCrossOrgPolicyRepository();
    await repo.upsert({ tenantId, kind: 'whitelist', whitelist: ['acme.test'] });
    const r = await repo.evaluate({ tenantId, senderDomain: 'acme.test' });
    expect(r).toEqual({ accepted: true, reason: 'whitelist-match' });
  });

  it('returns whitelist-miss for a non-allowed domain', async () => {
    const repo = new InMemoryCrossOrgPolicyRepository();
    await repo.upsert({ tenantId, kind: 'whitelist', whitelist: ['acme.test'] });
    const r = await repo.evaluate({ tenantId, senderDomain: 'evil.test' });
    expect(r).toEqual({ accepted: false, reason: 'whitelist-miss' });
  });

  it('matches whitelist case-insensitively', async () => {
    const repo = new InMemoryCrossOrgPolicyRepository();
    await repo.upsert({ tenantId, kind: 'whitelist', whitelist: ['ACME.test'] });
    const r = await repo.evaluate({ tenantId, senderDomain: 'acme.test' });
    expect(r.accepted).toBe(true);
  });

  it('isolates evaluation per tenant', async () => {
    const repo = new InMemoryCrossOrgPolicyRepository();
    const otherTenant = randomUUID();
    await repo.upsert({ tenantId, kind: 'block-all' });
    const r = await repo.evaluate({ tenantId: otherTenant, senderDomain: 'acme.test' });
    expect(r.accepted).toBe(true);
    expect(r.reason).toBe('accept-all');
  });
});
