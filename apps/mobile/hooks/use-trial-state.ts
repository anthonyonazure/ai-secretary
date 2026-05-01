export type TrialKind = 'pro' | 'business' | 'enterprise_pilot' | null;

export type TrialStateInput = {
  trialKind: TrialKind;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  trialCardOnFile: boolean;
  now?: number;
};

export type TrialBannerKind = 'none' | 'active' | 'ending-soon' | 'ending-today' | 'expired';

export type TrialState = {
  banner: TrialBannerKind;
  daysRemaining: number;
  showUpgradeCta: boolean;
  showAddCardCta: boolean;
  copy: string;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const deriveTrialState = (input: TrialStateInput): TrialState => {
  const { trialKind, trialEndsAt, trialCardOnFile } = input;
  const now = input.now ?? Date.now();
  if (trialKind === null || trialEndsAt === null) {
    return {
      banner: 'none',
      daysRemaining: 0,
      showUpgradeCta: false,
      showAddCardCta: false,
      copy: '',
    };
  }
  const ends = Date.parse(trialEndsAt);
  const remainingMs = ends - now;
  if (remainingMs <= 0) {
    const showUpgrade = trialKind === 'pro' && !trialCardOnFile;
    return {
      banner: 'expired',
      daysRemaining: 0,
      showUpgradeCta: showUpgrade,
      showAddCardCta: showUpgrade,
      copy:
        trialKind === 'pro'
          ? 'Your trial has ended. Add a card to keep recording.'
          : 'Your trial has ended. Contact your admin to continue.',
    };
  }
  const daysRemaining = Math.floor(remainingMs / ONE_DAY_MS);
  if (daysRemaining === 0) {
    return {
      banner: 'ending-today',
      daysRemaining: 0,
      showUpgradeCta: trialKind === 'pro',
      showAddCardCta: trialKind === 'pro' && !trialCardOnFile,
      copy: 'Trial ends today.',
    };
  }
  if (daysRemaining <= 3) {
    return {
      banner: 'ending-soon',
      daysRemaining,
      showUpgradeCta: trialKind === 'pro',
      showAddCardCta: trialKind === 'pro' && !trialCardOnFile,
      copy: `Trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
    };
  }
  return {
    banner: 'active',
    daysRemaining,
    showUpgradeCta: false,
    showAddCardCta: false,
    copy: `${daysRemaining} days left in your trial.`,
  };
};
