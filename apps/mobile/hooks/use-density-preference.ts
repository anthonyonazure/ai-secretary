export type DensityMode = 'dense' | 'relaxed' | 'accessible';

export type DensityInput = {
  userOverride: DensityMode | null;
  osPrefersContrast: boolean;
  osPrefersReducedMotion: boolean;
  verticalDefault: DensityMode;
};

export type DensityResolution = {
  mode: DensityMode;
  source: 'override' | 'os' | 'vertical';
};

export const resolveDensity = (input: DensityInput): DensityResolution => {
  if (input.userOverride !== null) {
    return { mode: input.userOverride, source: 'override' };
  }
  if (input.osPrefersContrast || input.osPrefersReducedMotion) {
    return { mode: 'accessible', source: 'os' };
  }
  return { mode: input.verticalDefault, source: 'vertical' };
};

export const verticalDefaultDensity = (
  vertical: 'general' | 'sales' | 'hr' | 'education' | 'medical' | 'support' | 'pm' | 'psychology',
): DensityMode => {
  switch (vertical) {
    case 'medical':
    case 'psychology':
      return 'relaxed';
    default:
      return 'dense';
  }
};
