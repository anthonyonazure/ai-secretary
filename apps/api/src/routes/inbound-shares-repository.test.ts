/**
 * Story 8.4 + ADR-0006 — `InMemoryInboundSharesRepository` unit tests.
 *
 * Verifies the receiving-tenant write path captures rows + de-dupes on
 * `(tenantId, sourceShareId)`. The deduplication is critical: every
 * source-side share creation triggers exactly one receive write per
 * sender, and re-firing must be idempotent.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  InMemoryInboundSharesRepository,
  type InboundShareInsert,
} from './inbound-shares-repository.js';

const receivingTenant = randomUUID();
const sourceTenant = randomUUID();

const baseInput = (overrides: Partial<InboundShareInsert> = {}): InboundShareInsert => ({
  tenantId: receivingTenant,
  sourceTenantId: sourceTenant,
  sourceTenantDomain: 'acme.test',
  sourceUserEmail: 'sender@acme.test',
  sourceShareId: randomUUID(),
  kind: 'meeting',
  recipientEmail: 'recipient@example.test',
  resourceLabel: 'Acme — discovery call',
  ...overrides,
});

describe('InMemoryInboundSharesRepository.recordInbound', () => {
  it('captures a row with default status pending + a generated id', async () => {
    const repo = new InMemoryInboundSharesRepository();
    const row = await repo.recordInbound(baseInput());
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.status).toBe('pending');
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(repo.rows).toHaveLength(1);
  });

  it('returns the existing row when called twice with the same sourceShareId', async () => {
    const repo = new InMemoryInboundSharesRepository();
    const sourceShareId = randomUUID();
    const first = await repo.recordInbound(baseInput({ sourceShareId }));
    const second = await repo.recordInbound(baseInput({ sourceShareId }));
    expect(second.id).toBe(first.id);
    expect(repo.rows).toHaveLength(1);
  });

  it('treats different receiving tenants as separate rows for the same sourceShareId', async () => {
    const repo = new InMemoryInboundSharesRepository();
    const sourceShareId = randomUUID();
    await repo.recordInbound(baseInput({ sourceShareId, tenantId: receivingTenant }));
    await repo.recordInbound(baseInput({ sourceShareId, tenantId: randomUUID() }));
    expect(repo.rows).toHaveLength(2);
  });

  it('preserves the kind field', async () => {
    const repo = new InMemoryInboundSharesRepository();
    const row = await repo.recordInbound(baseInput({ kind: 'token-url' }));
    expect(row.kind).toBe('token-url');
  });

  it('preserves the resource label', async () => {
    const repo = new InMemoryInboundSharesRepository();
    const row = await repo.recordInbound(baseInput({ resourceLabel: 'Patient #4421 — intake' }));
    expect(row.resourceLabel).toBe('Patient #4421 — intake');
  });

  it('passes through the optional tokenUrlHash + expiresAt', async () => {
    const repo = new InMemoryInboundSharesRepository();
    const expiresAt = new Date('2026-06-01T00:00:00Z');
    const row = await repo.recordInbound(baseInput({ tokenUrlHash: 'a'.repeat(64), expiresAt }));
    expect(row.tokenUrlHash).toBe('a'.repeat(64));
    expect(row.expiresAt).toEqual(expiresAt);
  });

  it('public rows array reflects insert order', async () => {
    const repo = new InMemoryInboundSharesRepository();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const sourceShareId of ids) {
      await repo.recordInbound(baseInput({ sourceShareId }));
    }
    expect(repo.rows.map((r) => r.sourceShareId)).toEqual(ids);
  });
});
