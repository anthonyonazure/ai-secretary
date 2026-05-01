import { describe, expect, it } from 'vitest';

import { deriveTenantRegionPin } from './use-tenant-region-pin.js';

const baseInput = {
  pinnedRegion: null,
  pinnedAtMs: null,
  pendingRegion: null,
  isPinning: false,
  errorMessage: null,
};

describe('deriveTenantRegionPin', () => {
  it('starts at unset with selection enabled', () => {
    const r = deriveTenantRegionPin(baseInput);
    expect(r.display).toBe('unset');
    expect(r.canSelect).toBe(true);
    expect(r.secondaryCopy).toMatch(/cannot be changed/);
  });

  it('shows confirm dialog when a pending region is selected', () => {
    const r = deriveTenantRegionPin({ ...baseInput, pendingRegion: 'us' });
    expect(r.display).toBe('pending');
    expect(r.showConfirmDialog).toBe(true);
  });

  it('hides confirm and shows progress while pinning is in flight', () => {
    const r = deriveTenantRegionPin({
      ...baseInput,
      pendingRegion: 'eu',
      isPinning: true,
    });
    expect(r.display).toBe('pending');
    expect(r.showConfirmDialog).toBe(false);
    expect(r.secondaryCopy).toMatch(/Pinning/);
  });

  it('locks the region once pinned', () => {
    const r = deriveTenantRegionPin({
      ...baseInput,
      pinnedRegion: 'eu',
      pinnedAtMs: 1_700_000_000_000,
    });
    expect(r.display).toBe('locked');
    expect(r.canSelect).toBe(false);
    expect(r.secondaryCopy).toMatch(/one-shot/);
  });

  it('renders region labels correctly', () => {
    expect(deriveTenantRegionPin({ ...baseInput, pinnedRegion: 'us' }).primaryCopy).toMatch(
      /United States/,
    );
    expect(deriveTenantRegionPin({ ...baseInput, pinnedRegion: 'eu' }).primaryCopy).toMatch(
      /European Union/,
    );
  });

  it('routes errors to the error display', () => {
    const r = deriveTenantRegionPin({ ...baseInput, errorMessage: 'Network error' });
    expect(r.display).toBe('error');
    expect(r.primaryCopy).toBe('Network error');
  });

  it('locks selection if an error fires after a successful pin', () => {
    const r = deriveTenantRegionPin({
      ...baseInput,
      pinnedRegion: 'us',
      errorMessage: 'something',
    });
    expect(r.canSelect).toBe(false);
  });
});
