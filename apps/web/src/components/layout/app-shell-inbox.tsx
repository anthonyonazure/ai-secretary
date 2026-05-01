/**
 * `AppShell.Inbox` — D1 default — Story 1.6.
 *
 * Two-column layout: persistent sidebar (collapsible at <1024px) +
 * content pane. Sidebar holds branding stub + nav. Header holds the
 * cmd-K trigger and the global `RecordingStatusPill` slot top-right
 * (UX spec U1: "the pill is in the top-right of every shell, never
 * moves"). Content area is a `<main>` element that hosts whichever
 * route is active via TanStack Router's `<Outlet />`.
 *
 * Mobile-first sizing: the sidebar drops to a collapsed icon rail at
 * widths below `md` (768px) and stays full-width at `lg` (1024px) and
 * up. The collapse toggle lives in the header.
 */

import { Outlet } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useRecordingPillState } from '../feature/recording/recording-state-store';
import { RecordingStatusPill } from '../feature/recording/recording-status-pill';
import { CommandPalette, CommandPaletteTrigger } from './command-palette';
import { SidebarNav } from './sidebar-nav';

export interface AppShellInboxProps {
  /**
   * Optional render override — used by stories that want to demo the
   * shell without the router. Production uses `<Outlet />`.
   */
  children?: ReactNode;
}

export function AppShellInbox({ children }: AppShellInboxProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pill = useRecordingPillState();

  return (
    <div data-shell="inbox" className="flex min-h-screen bg-bg text-fg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-modal focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-fg focus:shadow-md"
      >
        Skip to main content
      </a>

      {/* Sidebar */}
      <aside
        data-open={sidebarOpen ? 'true' : 'false'}
        aria-label="Sidebar"
        className="hidden w-60 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col data-[open=true]:flex data-[open=true]:fixed data-[open=true]:inset-y-0 data-[open=true]:left-0 data-[open=true]:z-modal data-[open=true]:w-64 data-[open=true]:flex-col"
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span aria-hidden="true" className="inline-block h-6 w-6 rounded-sm bg-accent" />
          <span className="font-sans text-sm font-semibold">AI Secretary</span>
        </div>
        <SidebarNav />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-recording-status flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
          <button
            type="button"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
          <CommandPaletteTrigger onOpen={() => setPaletteOpen(true)} />
          <div className="ml-auto flex items-center gap-2" data-slot="recording-pill">
            {/*
              Recording status pill slot — top-right of every shell,
              always (UX spec U1). The pill self-hides when state is
              `idle`, so the slot stays mounted but visually empty
              between recordings.
            */}
            <RecordingStatusPill
              state={pill.state}
              elapsedSeconds={pill.elapsedSeconds}
              {...(pill.device !== undefined ? { device: pill.device } : {})}
            />
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-auto">
          {children ?? <Outlet />}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
