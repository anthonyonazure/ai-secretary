/**
 * Vitest setup — registers @testing-library/jest-dom matchers + an
 * explicit cleanup hook for .test.tsx files that run under the jsdom
 * environment (configured in `vitest.config.ts` via
 * `environmentMatchGlobs`).
 *
 * Pure-logic .test.ts files run under `node` and don't need this file.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { initI18n } from '../i18n';

// Story 1.9 — initialize the global i18next instance once per test
// process. Components that call `useT()` without an explicit
// `<I18nextProvider>` will pick up the global instance via
// `initReactI18next`. Locale defaults to 'en' (fallbackLng). Tests
// that need to flip language can call `i18next.changeLanguage('fr')`
// before rendering.
initI18n();

afterEach(() => {
  cleanup();
});

// Node 25+ ships an experimental global `localStorage` polyfill whose
// API surface is incomplete (getItem / setItem / clear can throw under
// the default flags). It shadows jsdom's `window.localStorage` and
// breaks any test that touches storage directly. Replace it with a
// Map-backed in-memory shim that exposes the full Storage API. The
// shim is per-test-file (jsdom re-creates `window` between files), so
// state from one file never leaks into another.
//
// `use-auth.test.tsx` documents the same root cause and works around
// it via a per-file vi.mock; this setup-level replacement covers
// everything else without each test having to re-do the mock.
if (typeof window !== 'undefined') {
  // jsdom stub: TanStack Router calls `window.scrollTo` during route
  // transitions for scroll-restoration. jsdom doesn't implement it
  // and emits a noisy "Not implemented" warning each time. Override
  // unconditionally with a no-op so router-driven tests stay quiet.
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    writable: true,
    value: () => {
      /* noop */
    },
  });

  const map = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return map.size;
    },
    getItem(key: string): string | null {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    setItem(key: string, value: string): void {
      map.set(key, String(value));
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    clear(): void {
      map.clear();
    },
    key(index: number): string | null {
      return Array.from(map.keys())[index] ?? null;
    },
  };
  try {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: memoryStorage,
    });
  } catch {
    /* property locked — leave the host's storage in place */
  }
}

// jsdom polyfills — scrollIntoView is unimplemented, and HTMLMediaElement's
// `currentTime` setter is a no-op in jsdom (always reads back as 0). The
// TranscriptSeekPlayer (Story 3.5) relies on both. Stub them at setup so
// component tests can assert against the seek math directly.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {
    /* noop — jsdom polyfill */
  };
}

if (typeof HTMLMediaElement !== 'undefined') {
  // jsdom's HTMLMediaElement implements `currentTime` as a no-op setter.
  // Override on every prototype in the chain (HTMLMediaElement +
  // HTMLAudioElement when distinct) so assignment persists in tests.
  const protos: object[] = [HTMLMediaElement.prototype];
  if (
    typeof HTMLAudioElement !== 'undefined' &&
    HTMLAudioElement.prototype !== HTMLMediaElement.prototype
  ) {
    protos.push(HTMLAudioElement.prototype);
  }
  for (const proto of protos) {
    try {
      Object.defineProperty(proto, 'currentTime', {
        configurable: true,
        get() {
          return (this as { _currentTime?: number })._currentTime ?? 0;
        },
        set(value: number) {
          (this as { _currentTime?: number })._currentTime = value;
        },
      });
    } catch {
      /* property locked — instance-level patching needed in test */
    }
  }
  // Stub play/pause so the dialog's auto-play call doesn't reject.
  HTMLMediaElement.prototype.play = function playStub() {
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function pauseStub() {
    /* noop — jsdom polyfill */
  };
}
