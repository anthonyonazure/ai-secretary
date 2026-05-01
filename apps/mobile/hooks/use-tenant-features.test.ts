import { describe, expect, it } from 'vitest';

import { type TenantFeatureFlags, deriveFeatureVisibility } from './use-tenant-features.js';

const baseFlags: TenantFeatureFlags = {
  tier: 'pro',
  isOrgAdmin: false,
  isSingleUserMode: false,
  hasTeamLeadEntitlement: false,
  hasCrmEntitlement: false,
  hasLmsEntitlement: false,
  hasHubAppEntitlement: false,
  unlockedModuleIds: ['general'],
};

describe('deriveFeatureVisibility', () => {
  it('hides every org surface in single-user mode', () => {
    const r = deriveFeatureVisibility({
      ...baseFlags,
      isSingleUserMode: true,
      isOrgAdmin: true,
      hasTeamLeadEntitlement: true,
      hasCrmEntitlement: true,
      hasHubAppEntitlement: true,
    });
    expect(r.showTeamLeadSurface).toBe(false);
    expect(r.showAdminSurface).toBe(false);
    expect(r.showCrmExtension).toBe(false);
    expect(r.showHubApps).toBe(false);
  });

  it('shows admin surface only when role + non-single-user-mode', () => {
    expect(deriveFeatureVisibility({ ...baseFlags, isOrgAdmin: false }).showAdminSurface).toBe(
      false,
    );
    expect(deriveFeatureVisibility({ ...baseFlags, isOrgAdmin: true }).showAdminSurface).toBe(true);
  });

  it('shows team-lead surface only with the entitlement', () => {
    expect(
      deriveFeatureVisibility({ ...baseFlags, hasTeamLeadEntitlement: false }).showTeamLeadSurface,
    ).toBe(false);
    expect(
      deriveFeatureVisibility({ ...baseFlags, hasTeamLeadEntitlement: true }).showTeamLeadSurface,
    ).toBe(true);
  });

  it('upsells modules that are not in the unlocked set', () => {
    const r = deriveFeatureVisibility({
      ...baseFlags,
      unlockedModuleIds: ['general', 'sales'],
    });
    expect(r.showUpsellForModule('general')).toBe(false);
    expect(r.showUpsellForModule('sales')).toBe(false);
    expect(r.showUpsellForModule('medical')).toBe(true);
  });

  it('still shows LMS launch even in single-user mode (LMS is per-user)', () => {
    const r = deriveFeatureVisibility({
      ...baseFlags,
      isSingleUserMode: true,
      hasLmsEntitlement: true,
    });
    expect(r.showLmsLaunch).toBe(true);
  });

  it('hides hub apps when entitlement is off', () => {
    const r = deriveFeatureVisibility({
      ...baseFlags,
      hasHubAppEntitlement: false,
    });
    expect(r.showHubApps).toBe(false);
  });
});
