/**
 * Story 1.9 — web i18n bootstrap.
 *
 * Initializes a singleton i18next instance with EN + FR resources
 * loaded synchronously (bundled as JSON via Vite). Locale detection
 * uses `i18next-browser-languagedetector` — order: querystring →
 * localStorage → navigator. Falls back to `'en'` if the detected
 * language is not in the supported list.
 *
 * Resources are deliberately bundled (not loaded over the network)
 * so the first paint never has to wait on a fetch and so the build
 * artifact is fully self-contained.
 */

import { supportedLocales } from '@aisecretary/shared/i18n/anchor-word';
import i18next, { type i18n as I18nInstance } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

let initialized: I18nInstance | null = null;

/**
 * Synchronous i18n initializer. Safe to call more than once — the
 * second invocation returns the existing instance unchanged.
 */
export function initI18n(): I18nInstance {
  if (initialized) return initialized;

  // i18next.use(...) returns the same instance, so we chain plugins
  // before kicking off init().
  i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        fr: { translation: fr },
      },
      fallbackLng: 'en',
      supportedLngs: [...supportedLocales],
      nonExplicitSupportedLngs: true,
      interpolation: {
        // React already escapes — disable double-escaping.
        escapeValue: false,
      },
      detection: {
        order: ['querystring', 'localStorage', 'navigator'],
        lookupQuerystring: 'lang',
        lookupLocalStorage: 'aisec.locale',
        caches: ['localStorage'],
      },
      // Keep init synchronous: resources are bundled, so we never
      // need the i18next async backend pipeline.
      initImmediate: false,
      returnNull: false,
    });

  initialized = i18next;
  return i18next;
}

export { i18next };
