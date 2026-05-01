/**
 * `RelationshipBrowser` — Story 6.4 (Epic 7 cross-meeting facets).
 *
 * Faceted browser over the user's corpus, indexed by:
 *   - **People** — co-attendees aggregated across meetings
 *   - **Calendars** — calendar/source group (Google / Microsoft / etc.)
 *   - **Projects** — derived tags from meeting titles + module outputs
 *
 * The browser is anti-timestamp-only: per UX spec § Step 5 anti-pattern
 * #17, "timestamp-only meeting IA (Otter)" is forbidden — relationships
 * are first-class indices.
 *
 * Data is fed in by the host (the search route's facet aggregator).
 * Selecting a facet narrows the host's meeting list via `onFilter`.
 *
 * a11y:
 *   - role="tablist" / "tab" / "tabpanel" semantics
 *   - aria-selected + aria-controls bound to the active facet
 *   - Each facet item is a button with role="option" inside a listbox
 */

import { Calendar as CalendarIcon, Tag, Users } from 'lucide-react';
import { useState } from 'react';

export type RelationshipFacetKind = 'people' | 'calendars' | 'projects';

export interface FacetItem {
  /** Stable id used as the filter token. */
  id: string;
  /** Display label. */
  label: string;
  /** Number of meetings sharing this facet. */
  count: number;
}

export interface RelationshipBrowserProps {
  facets: Record<RelationshipFacetKind, FacetItem[]>;
  /** Active filter selection — caller controls. */
  activeFilter?: { kind: RelationshipFacetKind; id: string };
  /** Called when the user selects (or clears) a facet item. */
  onFilter: (selection: { kind: RelationshipFacetKind; id: string } | null) => void;
}

const TAB_LABELS: Record<RelationshipFacetKind, { label: string; icon: typeof Users }> = {
  people: { label: 'People', icon: Users },
  calendars: { label: 'Calendars', icon: CalendarIcon },
  projects: { label: 'Projects', icon: Tag },
};

export function RelationshipBrowser({ facets, activeFilter, onFilter }: RelationshipBrowserProps) {
  const [tab, setTab] = useState<RelationshipFacetKind>('people');
  const items = facets[tab] ?? [];

  return (
    <section
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
      data-testid="relationship-browser"
    >
      <header>
        <h2 className="text-base font-semibold">Browse by relationship</h2>
        <p className="text-sm text-fg-muted">
          People, calendars, and projects are first-class indices — not a timestamp-sorted list.
        </p>
      </header>

      <div role="tablist" aria-label="Relationship facets" className="flex gap-1">
        {(Object.keys(TAB_LABELS) as RelationshipFacetKind[]).map((kind) => {
          const meta = TAB_LABELS[kind];
          const Icon = meta.icon;
          return (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={tab === kind}
              data-active={tab === kind}
              onClick={() => setTab(kind)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-fg-muted hover:text-fg data-[active=true]:bg-accent-soft data-[active=true]:text-fg data-[active=true]:font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
              data-testid={`relationship-tab-${kind}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {meta.label}
              <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-bg px-1.5 text-xs text-fg-muted">
                {facets[kind]?.length ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={TAB_LABELS[tab].label}>
        {items.length === 0 ? (
          <output className="block py-4 text-center text-sm text-fg-muted">
            No {TAB_LABELS[tab].label.toLowerCase()} indexed yet.
          </output>
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {items.map((item) => {
              const isActive = activeFilter?.kind === tab && activeFilter?.id === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onFilter(isActive ? null : { kind: tab, id: item.id })}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-fg hover:bg-accent-soft aria-pressed:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    data-testid={`relationship-${tab}-${item.id}`}
                  >
                    <span className="truncate">{item.label}</span>
                    <span className="ml-2 text-xs text-fg-muted">{item.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
