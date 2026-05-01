/**
 * Shell-mode store — Story 1.6.
 *
 * Drives the top-level decision between `AppShell.Inbox` (D1 default,
 * org-context user) and `AppShell.Cards` (D3 single-user mode). The UX
 * spec calls this out: shell selection is at the route level based on
 * `tenant.mode`. The `tenant.mode` field doesn't exist in the schema
 * yet, so we fake the selection via this client-side Zustand store
 * persisted to `localStorage`.
 *
 * TODO(future Story): replace with `tenant.mode` field on the `tenants`
 * table — when the API exposes it, swap this store for a server-state
 * accessor (probably a React Query hook over `/api/v1/tenants/me`)
 * keyed by `useAuth().user.tenantId`. The component-level API of
 * `useShellMode()` stays identical so consumers don't have to change.
 *
 * The `?mode=cards` query param on first visit is honoured by the
 * initialiser below (see `readInitialMode`); after that the localStorage
 * value wins. The "Show organization features" toggle inside
 * `AppShell.Cards` flips the mode back to `'inbox'` and persists.
 */

import { create } from 'zustand';

export type ShellMode = 'inbox' | 'cards';

const STORAGE_KEY = 'aisecretary.shell-mode';

interface ShellModeStoreState {
  mode: ShellMode;
  setMode: (mode: ShellMode) => void;
  toggle: () => void;
}

function isShellMode(value: unknown): value is ShellMode {
  return value === 'inbox' || value === 'cards';
}

function readInitialMode(): ShellMode {
  if (typeof window === 'undefined') return 'inbox';
  // 1. URL override — only honoured on first visit, before the store
  //    persists. Lets first-time single-user signups land directly in
  //    `cards` mode without an extra round-trip.
  try {
    const params = new URLSearchParams(window.location.search);
    const queryMode = params.get('mode');
    if (isShellMode(queryMode)) {
      window.localStorage.setItem(STORAGE_KEY, queryMode);
      return queryMode;
    }
  } catch {
    // URLSearchParams or location access can throw under some sandboxed
    // hosts; fall through to localStorage.
  }
  // 2. Persisted value from a previous session.
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isShellMode(stored)) return stored;
  } catch {
    // Access to localStorage can throw under privacy modes; default.
  }
  return 'inbox';
}

function writeMode(mode: ShellMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Quota / privacy-mode failures are non-fatal — the store just
    // doesn't survive a refresh.
  }
}

export const useShellModeStore = create<ShellModeStoreState>()((set, get) => ({
  mode: readInitialMode(),
  setMode: (mode) => {
    writeMode(mode);
    set({ mode });
  },
  toggle: () => {
    const next: ShellMode = get().mode === 'inbox' ? 'cards' : 'inbox';
    writeMode(next);
    set({ mode: next });
  },
}));

/** Convenience hook — returns just the current mode. */
export function useShellMode(): ShellMode {
  return useShellModeStore((s) => s.mode);
}

/** Test-only: reset both the store and the persisted value. */
export function __resetShellModeStoreForTests(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  useShellModeStore.setState({ mode: 'inbox' });
}

export const __SHELL_MODE_STORAGE_KEY = STORAGE_KEY;
