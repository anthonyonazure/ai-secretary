/**
 * Theme / density / motion mode store — Story 1.6.
 *
 * The token taxonomy (arch-addendums § Token taxonomy) splits visual
 * mode classes onto three independent axes that compose on the root
 * div:
 *
 *   - theme:   `theme-light` (default) | `theme-dark`
 *   - density: `density-relaxed` (default) | `density-dense` | `density-accessible`
 *   - motion:  `motion-default` (default) | `motion-gentle` | `motion-reduced`
 *
 * `AppShellFrame` consumes this store and applies the resulting class
 * combination on the outermost div. Storybook already exercises the
 * three axes via `withThemeByClassName` decorators in
 * `.storybook/preview.ts` — this store is the production runtime
 * equivalent.
 *
 * NOTE: Story 1.6 only ships the underlying composition. The full
 * settings UI (theme picker, density picker, motion picker) lands in a
 * later story; for now the values default to the documented baseline
 * and rehydrate from localStorage so power-users who set them via
 * devtools don't lose their preference on reload.
 */

import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type Density = 'relaxed' | 'dense' | 'accessible';
export type Motion = 'default' | 'gentle' | 'reduced';

const STORAGE_KEY = 'aisecretary.theme-mode';

interface ThemeModeStoreState {
  theme: Theme;
  density: Density;
  motion: Motion;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
  setMotion: (motion: Motion) => void;
}

interface PersistedShape {
  theme?: unknown;
  density?: unknown;
  motion?: unknown;
}

const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark';
const isDensity = (v: unknown): v is Density =>
  v === 'relaxed' || v === 'dense' || v === 'accessible';
const isMotion = (v: unknown): v is Motion => v === 'default' || v === 'gentle' || v === 'reduced';

function readInitial(): { theme: Theme; density: Density; motion: Motion } {
  const fallback = {
    theme: 'light' as const,
    density: 'relaxed' as const,
    motion: 'default' as const,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PersistedShape;
    return {
      theme: isTheme(parsed.theme) ? parsed.theme : fallback.theme,
      density: isDensity(parsed.density) ? parsed.density : fallback.density,
      motion: isMotion(parsed.motion) ? parsed.motion : fallback.motion,
    };
  } catch {
    return fallback;
  }
}

function persist(state: { theme: Theme; density: Density; motion: Motion }): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* non-fatal */
  }
}

export const useThemeModeStore = create<ThemeModeStoreState>()((set, get) => ({
  ...readInitial(),
  setTheme: (theme) => {
    set({ theme });
    persist({ theme, density: get().density, motion: get().motion });
  },
  setDensity: (density) => {
    set({ density });
    persist({ theme: get().theme, density, motion: get().motion });
  },
  setMotion: (motion) => {
    set({ motion });
    persist({ theme: get().theme, density: get().density, motion });
  },
}));

/**
 * Build the className string applied to the AppShellFrame root.
 * Theme = `''` for light (no class needed; light is the default scope
 * inside `tokens.css`), `theme-dark` otherwise.
 */
export function buildModeClassName(state: {
  theme: Theme;
  density: Density;
  motion: Motion;
}): string {
  const parts: string[] = [];
  if (state.theme === 'dark') parts.push('theme-dark');
  parts.push(`density-${state.density}`);
  parts.push(`motion-${state.motion}`);
  return parts.join(' ');
}

/** Hook returning a memo-friendly composed className string. */
export function useThemeModeClassName(): string {
  const theme = useThemeModeStore((s) => s.theme);
  const density = useThemeModeStore((s) => s.density);
  const motion = useThemeModeStore((s) => s.motion);
  return buildModeClassName({ theme, density, motion });
}

export const __THEME_MODE_STORAGE_KEY = STORAGE_KEY;
