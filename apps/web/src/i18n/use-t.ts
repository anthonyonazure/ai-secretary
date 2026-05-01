/**
 * Story 1.9 — `useT` hook.
 *
 * Thin wrapper over `react-i18next`'s `useTranslation` that adds:
 *   - a typed `locale` derived from `i18n.resolvedLanguage`
 *   - an `anchor(vertical?)` helper that resolves the anchor word for
 *     the current locale + an optional vertical (Story 1.9 anchor-word
 *     substrate)
 *   - a stable `changeLanguage` reference for settings UIs
 *
 * Components prefer this hook over reaching for `useTranslation`
 * directly so the anchor-word logic stays centralised.
 */

import {
  type SupportedLocale,
  anchorWord,
  supportedLocales,
} from '@aisecretary/shared/i18n/anchor-word';
import type { ModuleId } from '@aisecretary/shared/schemas/module-output';
import { useTranslation } from 'react-i18next';

function isSupportedLocale(input: string | undefined): input is SupportedLocale {
  return !!input && (supportedLocales as ReadonlyArray<string>).includes(input);
}

export interface UseTReturn {
  t: ReturnType<typeof useTranslation>['t'];
  locale: SupportedLocale;
  anchor: (vertical?: ModuleId) => string;
  changeLanguage: (lng: SupportedLocale) => Promise<unknown>;
}

export function useT(): UseTReturn {
  const { t, i18n } = useTranslation();
  const resolved = i18n.resolvedLanguage ?? i18n.language;
  const locale: SupportedLocale = isSupportedLocale(resolved) ? resolved : 'en';
  return {
    t,
    locale,
    anchor: (vertical?: ModuleId) =>
      vertical === undefined ? anchorWord({ locale }) : anchorWord({ locale, vertical }),
    changeLanguage: (lng) => i18n.changeLanguage(lng),
  };
}
