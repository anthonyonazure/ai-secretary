/**
 * Sidebar navigation for `AppShell.Inbox` (D1) — Story 1.6.
 *
 * The full sidebar set per UX spec § Navigation patterns is "Today /
 * My Actions / Search / Chat / Recordings / Settings". Story 1.6 only
 * ships the routes that exist today — Inbox, Record, Settings — and
 * leaves placeholder rows for the rest with `aria-disabled` so the
 * shell visually approximates the locked layout without dead links.
 *
 * Branding stub at the top is a text mark for now; the locked
 * design-foundation typeface and visual mockups (in `_bmad-output/`)
 * inform later iteration.
 */

import { Link } from '@tanstack/react-router';
import { Home, Inbox, ListChecks, Mic, Search, Settings, Users } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

interface SidebarNavLink {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Indicates the route doesn't exist yet — render as disabled. */
  pending?: boolean;
}

const NAV_LINKS: ReadonlyArray<SidebarNavLink> = [
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/actions', label: 'My Actions', icon: ListChecks },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/record', label: 'Record', icon: Mic },
  // Pending entries sit here so the visual rhythm matches the locked
  // UX spec; routes land in later epics.
  { to: '/today', label: 'Today', icon: Home, pending: true },
  { to: '/search', label: 'Search', icon: Search, pending: true },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function SidebarNav() {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1 px-2 py-3">
      {NAV_LINKS.map((link) => {
        const Icon = link.icon;
        if (link.pending) {
          return (
            <span
              key={link.to}
              aria-disabled="true"
              data-pending="true"
              className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm text-fg-muted opacity-60"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {link.label}
            </span>
          );
        }
        return (
          <Link
            key={link.to}
            to={link.to}
            activeProps={{ 'data-active': 'true' }}
            className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm text-fg hover:bg-accent-soft data-[active=true]:bg-accent-soft data-[active=true]:font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
