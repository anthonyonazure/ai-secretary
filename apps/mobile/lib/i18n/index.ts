/**
 * Story 1.9 — mobile i18n bootstrap.
 *
 * Mirrors `apps/web/src/i18n/index.ts` but uses `expo-localization` to
 * pick the device locale at boot. EN + FR resources are bundled, so
 * init is fully synchronous. Falls back to `'en'` if the device
 * locale is not in the supported list.
 */

import { supportedLocales } from '@aisecretary/shared/i18n/anchor-word';
import * as Localization from 'expo-localization';
import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

let initialized: I18nInstance | null = null;

function detectLocale(): string {
  const locales = Localization.getLocales();
  const first = locales[0];
  // `languageCode` is the bare ISO 639-1 (e.g. "fr"); `languageTag`
  // includes region (e.g. "fr-CA"). i18next is happy with either —
  // its `nonExplicitSupportedLngs: true` matches "fr-CA" → "fr".
  return first?.languageCode ?? first?.languageTag ?? 'en';
}

/**
 * Synchronous i18n initializer. Safe to call more than once.
 */
export function initI18n(): I18nInstance {
  if (initialized) return initialized;

  i18next.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng: detectLocale(),
    fallbackLng: 'en',
    supportedLngs: [...supportedLocales],
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false,
    },
    initImmediate: false,
    returnNull: false,
  });

  initialized = i18next;
  return i18next;
}

export { i18next };
