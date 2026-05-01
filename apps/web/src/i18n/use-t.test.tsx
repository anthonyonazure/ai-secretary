/// <reference lib="dom" />

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { i18next, initI18n } from './index';
import { useT } from './use-t';

initI18n();

afterEach(async () => {
  await i18next.changeLanguage('en');
});

function Probe({ vertical }: { vertical?: 'general' | 'medical' | 'sales' }) {
  const { t, anchor, locale } = useT();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="signup-submit">{t('auth.signup.submit')}</span>
      <span data-testid="anchor">{anchor(vertical)}</span>
    </div>
  );
}

describe('useT (Story 1.9)', () => {
  it('returns English translations + receipt anchor by default', () => {
    render(<Probe />);
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
    expect(screen.getByTestId('signup-submit')).toHaveTextContent('Create account');
    expect(screen.getByTestId('anchor')).toHaveTextContent('receipt');
  });

  it('flips translations after changeLanguage("fr")', async () => {
    await i18next.changeLanguage('fr');
    render(<Probe />);
    expect(screen.getByTestId('locale')).toHaveTextContent('fr');
    expect(screen.getByTestId('signup-submit')).toHaveTextContent('Créer le compte');
    expect(screen.getByTestId('anchor')).toHaveTextContent('reçu');
  });

  it('overrides anchor word for clinical verticals', async () => {
    await i18next.changeLanguage('en');
    render(<Probe vertical="medical" />);
    expect(screen.getByTestId('anchor')).toHaveTextContent('session note');
  });

  it('falls back to receipt for non-clinical verticals', () => {
    render(<Probe vertical="sales" />);
    expect(screen.getByTestId('anchor')).toHaveTextContent('receipt');
  });

  it('interpolates anchor into onboarding subheading', () => {
    render(<I18nProbeForKey i18nKey="onboarding.empty.subheading" />);
    expect(screen.getByTestId('out')).toHaveTextContent(/receipt flow end-to-end/);
  });
});

function I18nProbeForKey({ i18nKey }: { i18nKey: string }) {
  const { t, anchor } = useT();
  return <span data-testid="out">{t(i18nKey, { anchor: anchor() })}</span>;
}
