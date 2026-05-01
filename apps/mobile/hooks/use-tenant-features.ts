export type TenantTier = 'free' | 'pro' | 'business' | 'enterprise';

export type TenantFeatureFlags = {
  tier: TenantTier;
  isOrgAdmin: boolean;
  isSingleUserMode: boolean;
  hasTeamLeadEntitlement: boolean;
  hasCrmEntitlement: boolean;
  hasLmsEntitlement: boolean;
  hasHubAppEntitlement: boolean;
  unlockedModuleIds: ReadonlyArray<string>;
};

export type FeatureVisibility = {
  showTeamLeadSurface: boolean;
  showAdminSurface: boolean;
  showCrmExtension: boolean;
  showLmsLaunch: boolean;
  showHubApps: boolean;
  showUpsellForModule: (moduleId: string) => boolean;
  showShareToCrm: boolean;
};

export const deriveFeatureVisibility = (flags: TenantFeatureFlags): FeatureVisibility => {
  const unlocked = new Set(flags.unlockedModuleIds);
  return {
    showTeamLeadSurface: !flags.isSingleUserMode && flags.hasTeamLeadEntitlement,
    showAdminSurface: flags.isOrgAdmin && !flags.isSingleUserMode,
    showCrmExtension: !flags.isSingleUserMode && flags.hasCrmEntitlement,
    showLmsLaunch: flags.hasLmsEntitlement,
    showHubApps: !flags.isSingleUserMode && flags.hasHubAppEntitlement,
    showShareToCrm: !flags.isSingleUserMode && flags.hasCrmEntitlement,
    showUpsellForModule: (moduleId: string) => !unlocked.has(moduleId),
  };
};
