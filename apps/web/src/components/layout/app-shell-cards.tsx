/**
 * `AppShell.Cards` — D3 single-user mode — Story 1.6.
 *
 * Single-column layout, minimal header (logo + cmd-K + recording pill
 * + avatar — UX spec § Navigation patterns). No sidebar, no admin
 * sub-product visible. The visibility-layer (`HideInSingleUser`) hides
 * team-lead / admin / embed surfaces from any nested content; this
 * shell renders the pill in the same top-right slot as `AppShell.Inbox`
 * so the shell switch doesn't move the pill.
 *
 * The "Show organization features" toggle in the header flips
 * `useShellMode()` from `cards` back to `inbox` — the locked UX spec
 * decision: single-user is a calmer surface, with the org-mode
 * promotion always one click away.
 */

import { Outlet } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useRecordingPillState } from '../feature/recording/recording-state-store';
import { RecordingStatusPill } from '../feature/recording/recording-status-pill';
import { CommandPalette, CommandPaletteTrigger } from './command-palette';
import { useShellModeStore } from './shell-mode-store';

export interface AppShellCardsProps {
  /**
   * Optional render override — used by stories. Production uses
   * `<Outlet />`.
   */
  children?: ReactNode;
}

export function AppShellCards({ children }: AppShellCardsProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const setMode = useShellModeStore((s) => s.setMode);
  const pill = useRecordingPillState();

  return (
    <div data-shell="cards" className="flex min-h-screen flex-col bg-bg text-fg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-modal focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-fg focus:shadow-md"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-recording-status flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
        <span aria-hidden="true" className="inline-block h-6 w-6 rounded-sm bg-accent" />
        <span className="font-sans text-sm font-semibold">AI Secretary</span>
        <CommandPaletteTrigger onOpen={() => setPaletteOpen(true)} />

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            data-testid="show-org-features-toggle"
            onClick={() => setMode('inbox')}
            className="inline-flex h-9 items-center rounded-md border border-border bg-bg px-3 text-xs font-medium text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            Show organization features
          </button>
          <div className="flex items-center gap-2" data-slot="recording-pill">
            <RecordingStatusPill
              state={pill.state}
              elapsedSeconds={pill.elapsedSeconds}
              {...(pill.device !== undefined ? { device: pill.device } : {})}
            />
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {children ?? <Outlet />}
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
