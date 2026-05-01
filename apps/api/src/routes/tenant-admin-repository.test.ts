/**
 * Story 12.1 — `InMemoryTenantAdminRepository` unit tests.
 *
 * Locks the tenant lifecycle FSM transitions used by F2-admin
 * onboarding: DPA acceptance, region-pin one-shot per ADR-0004.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  InMemoryTenantAdminRepository,
  RegionAlreadyPinnedError,
  type TenantStateRow,
} from './tenant-admin-repository.js';

const tenantId = randomUUID();
const userId = randomUUID();

const seedRow = (overrides: Partial<TenantStateRow> = {}): TenantStateRow => ({
  id: tenantId,
  state: 'draft',
  region: 'us',
  dpaVersion: null,
  dpaAcceptedAt: null,
  regionLockedAt: null,
  ...overrides,
});

describe('InMemoryTenantAdminRepository.findState', () => {
  it('returns the seeded row', async () => {
    const repo = new InMemoryTenantAdminRepository();
    repo.seed(seedRow());
    const found = await repo.findState(tenantId);
    expect(found?.id).toBe(tenantId);
  });

  it('returns null when no row exists', async () => {
    const repo = new InMemoryTenantAdminRepository();
    expect(await repo.findState(randomUUID())).toBeNull();
  });
});

describe('InMemoryTenantAdminRepository.acceptDpa', () => {
  it('flips state to dpa_accepted with version + timestamp', async () => {
    const repo = new InMemoryTenantAdminRepository();
    repo.seed(seedRow());
    const updated = await repo.acceptDpa({ tenantId, userId, dpaVersion: 'v1.0' });
    expect(updated.state).toBe('dpa_accepted');
    expect(updated.dpaVersion).toBe('v1.0');
    expect(updated.dpaAcceptedAt).toBeInstanceOf(Date);
  });

  it('throws when the tenant is not seeded', async () => {
    const repo = new InMemoryTenantAdminRepository();
    await expect(
      repo.acceptDpa({ tenantId: randomUUID(), userId, dpaVersion: 'v1' }),
    ).rejects.toThrow(/not found/);
  });
});

describe('InMemoryTenantAdminRepository.pinRegion', () => {
  it('pins region + transitions to provisioning + stamps regionLockedAt', async () => {
    const repo = new InMemoryTenantAdminRepository();
    repo.seed(seedRow({ state: 'dpa_accepted', region: 'us' }));
    const updated = await repo.pinRegion({ tenantId, region: 'eu' });
    expect(updated.region).toBe('eu');
    expect(updated.state).toBe('provisioning');
    expect(updated.regionLockedAt).toBeInstanceOf(Date);
  });

  it('throws RegionAlreadyPinnedError on a second pin attempt (one-shot)', async () => {
    const repo = new InMemoryTenantAdminRepository();
    repo.seed(seedRow({ regionLockedAt: new Date('2026-04-29T00:00:00Z'), region: 'us' }));
    await expect(repo.pinRegion({ tenantId, region: 'eu' })).rejects.toBeInstanceOf(
      RegionAlreadyPinnedError,
    );
  });

  it('throws when the tenant is not seeded', async () => {
    const repo = new InMemoryTenantAdminRepository();
    await expect(repo.pinRegion({ tenantId: randomUUID(), region: 'us' })).rejects.toThrow(
      /not found/,
    );
  });

  it('preserves the original region in the error message', async () => {
    const repo = new InMemoryTenantAdminRepository();
    const lockedAt = new Date('2026-04-29T00:00:00Z');
    repo.seed(seedRow({ regionLockedAt: lockedAt, region: 'us' }));
    try {
      await repo.pinRegion({ tenantId, region: 'eu' });
      throw new Error('expected RegionAlreadyPinnedError');
    } catch (err) {
      expect(err).toBeInstanceOf(RegionAlreadyPinnedError);
      expect((err as Error).message).toContain('us');
    }
  });
});
