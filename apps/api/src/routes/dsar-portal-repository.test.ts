/**
 * Story 14.3 / FR52 — `InMemoryDsarPortalRepository` unit tests.
 *
 * Locks: token hashing on write, lowercase email + tenantSlug
 * normalization, default `pending-verification` status, lookup by
 * sha256 hash, and the verify state transition.
 */

import { describe, expect, it } from 'vitest';

import {
  type CreateSubmissionInput,
  InMemoryDsarPortalRepository,
  sha256Hex,
} from './dsar-portal-repository.js';

const baseInput = (overrides: Partial<CreateSubmissionInput> = {}): CreateSubmissionInput => ({
  kind: 'access',
  email: 'subject@example.test',
  fullName: 'Subject Person',
  tenantSlug: 'acme',
  description: 'Please show me what data you hold about me.',
  verificationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  ...overrides,
});

describe('InMemoryDsarPortalRepository.create', () => {
  it('returns a plaintext token + persisted row with sha256 hash', async () => {
    const repo = new InMemoryDsarPortalRepository();
    const result = await repo.create(baseInput());
    expect(result.plaintextToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.row.verificationTokenHash).toBe(sha256Hex(result.plaintextToken));
  });

  it('starts every submission in pending-verification', async () => {
    const repo = new InMemoryDsarPortalRepository();
    const r = await repo.create(baseInput());
    expect(r.row.status).toBe('pending-verification');
    expect(r.row.verifiedAt).toBeNull();
  });

  it('lowercases the email + tenantSlug at write time', async () => {
    const repo = new InMemoryDsarPortalRepository();
    const r = await repo.create(baseInput({ email: 'Subject@Example.test', tenantSlug: 'ACME' }));
    expect(r.row.email).toBe('subject@example.test');
    expect(r.row.tenantSlug).toBe('acme');
  });

  it('preserves the secondary verification when set', async () => {
    const repo = new InMemoryDsarPortalRepository();
    const r = await repo.create(baseInput({ secondaryVerification: '+1-555-0123' }));
    expect(r.row.secondaryVerification).toBe('+1-555-0123');
  });

  it('defaults the secondary verification to null', async () => {
    const repo = new InMemoryDsarPortalRepository();
    const r = await repo.create(baseInput());
    expect(r.row.secondaryVerification).toBeNull();
  });

  it('captures the kind as provided', async () => {
    const repo = new InMemoryDsarPortalRepository();
    const a = await repo.create(baseInput({ kind: 'deletion' }));
    const b = await repo.create(baseInput({ kind: 'correction' }));
    expect(a.row.kind).toBe('deletion');
    expect(b.row.kind).toBe('correction');
  });
});

describe('InMemoryDsarPortalRepository.findByTokenHash', () => {
  it('returns the row matching the sha256-hashed token', async () => {
    const repo = new InMemoryDsarPortalRepository();
    const r = await repo.create(baseInput());
    const found = await repo.findByTokenHash(r.row.verificationTokenHash);
    expect(found?.id).toBe(r.row.id);
  });

  it('returns null on an unknown hash', async () => {
    const repo = new InMemoryDsarPortalRepository();
    expect(await repo.findByTokenHash('nope')).toBeNull();
  });
});

describe('InMemoryDsarPortalRepository.markVerified', () => {
  it('flips the status to verified + stamps verifiedAt', async () => {
    const repo = new InMemoryDsarPortalRepository();
    const r = await repo.create(baseInput());
    const at = new Date('2026-04-30T12:00:00Z');
    const updated = await repo.markVerified(r.row.id, at);
    expect(updated.status).toBe('verified');
    expect(updated.verifiedAt).toEqual(at);
  });

  it('throws on an unknown id', async () => {
    const repo = new InMemoryDsarPortalRepository();
    await expect(repo.markVerified('nope', new Date())).rejects.toThrow(/not found/);
  });
});

describe('sha256Hex', () => {
  it('produces a stable 64-char hex digest', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
