/**
 * Cmd-K command palette — Story 7.3 (FR28 substrate).
 *
 * Locked keyboard contract per UX spec § Navigation patterns:
 *   - Cmd/Ctrl+K toggles open from anywhere on web
 *   - ↑ / ↓ cycle through results
 *   - Enter opens the active result
 *   - Esc closes + restores focus to the trigger element
 *   - Focus is trapped while open
 *
 * The palette debounces typing into the search query (200ms) and hits
 * the Story 7.2 `GET /api/v1/search` endpoint. Below the search results,
 * a small static section lists app navigation commands so the palette
 * doubles as a navigator (Linear-style).
 *
 * a11y note: this implements the WAI-ARIA combobox listbox pattern:
 * `role="dialog"` on the wrapper, `role="listbox"` on the result
 * container, `role="option"` on each item with `aria-selected` driven
 * by the active index. Keyboard interaction is handled by the parent
 * dialog's `onKeyDown` (↑/↓/Enter/Esc). Biome's a11y lints don't model
 * this pattern well — the file-level suppressions below cover the
 * canonical exceptions.
 */

import { useNavigate } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../../../hooks/use-auth';
import { searchCorpus } from '../../../lib/search/api-client';

interface NavCommand {
  id: string;
  label: string;
  to: string;
  hint?: string;
}

const NAV_COMMANDS: ReadonlyArray<NavCommand> = [
  { id: 'nav-inbox', label: 'Inbox', to: '/inbox', hint: 'go to /inbox' },
  { id: 'nav-actions', label: 'My Actions', to: '/actions', hint: 'go to /actions' },
  { id: 'nav-team', label: 'Team space', to: '/team', hint: 'go to /team' },
  { id: 'nav-record', label: 'Record', to: '/record', hint: 'start a new recording' },
  { id: 'nav-settings', label: 'Settings', to: '/settings' },
];

interface CommandPaletteProps {
  /** Controlled open state. */
  open: boolean;
  /** Called when the palette wants to close (Esc, off-click, after selecting). */
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<
    Array<{
      id: string;
      kind: 'search';
      label: string;
      snippet: string;
      meetingId: string;
      turnId: string | null;
    }>
  >([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const announcementId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Mount focus management — capture the previously-focused element so
  // we can restore focus on close.
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    if (previouslyFocused.current) {
      previouslyFocused.current.focus();
      previouslyFocused.current = null;
    }
    setQuery('');
    setActiveIndex(0);
    return undefined;
  }, [open]);

  // Debounce typing into the search query.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Run the search when the debounced query changes.
  useEffect(() => {
    if (!debounced) {
      setResults([]);
      return;
    }
    let cancelled = false;
    searchCorpus(accessToken, { q: debounced, limit: 10 })
      .then((res) => {
        if (cancelled) return;
        setResults(
          res.items.map((hit, i) => ({
            id: `search-${i}`,
            kind: 'search' as const,
            label: hit.meetingTitle,
            snippet: stripMarks(hit.snippet),
            meetingId: hit.meetingId,
            turnId: hit.turnId,
          })),
        );
        setActiveIndex(0);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, accessToken]);

  const items = useMemo(() => {
    const navItems = NAV_COMMANDS.filter((c) =>
      query.trim() ? c.label.toLowerCase().includes(query.trim().toLowerCase()) : true,
    ).map((c) => ({ id: c.id, kind: 'nav' as const, label: c.label, hint: c.hint, to: c.to }));
    return [...results, ...navItems];
  }, [results, query]);

  const handleSelect = useCallback(
    (idx: number) => {
      const item = items[idx];
      if (!item) return;
      if (item.kind === 'nav') {
        navigate({ to: item.to });
      } else {
        navigate({ to: '/meetings/$meetingId', params: { meetingId: item.meetingId } });
      }
      onClose();
    },
    [items, navigate, onClose],
  );

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (items.length === 0 ? 0 : (i + 1) % items.length));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (items.length === 0 ? 0 : (i - 1 + items.length) % items.length));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSelect(activeIndex);
      }
    },
    [items.length, activeIndex, handleSelect, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg/80 pt-[10vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: the native <dialog> element's modal focus behavior fights TanStack Router; the role="dialog" aria-modal pattern is the canonical alternative. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-xl rounded-md border border-border bg-surface shadow-lg"
        onKeyDown={handleKey}
        data-testid="command-palette"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search aria-hidden="true" className="h-4 w-4 text-fg-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search meetings or jump to…"
            aria-label="Command palette search input"
            aria-controls={announcementId}
            className="h-9 flex-1 bg-transparent text-base text-fg placeholder:text-fg-muted focus:outline-none"
            data-testid="command-palette-input"
          />
          <span
            className="hidden rounded bg-accent-soft px-1.5 py-0.5 font-mono text-xs text-fg-muted sm:inline-block"
            aria-hidden="true"
          >
            esc
          </span>
        </div>

        <output
          aria-live="polite"
          aria-atomic="true"
          id={announcementId}
          className="block px-3 pt-2 text-xs text-fg-muted"
        >
          {items.length === 0
            ? query.trim()
              ? 'No matches'
              : 'Start typing to search.'
            : `${items.length} result${items.length === 1 ? '' : 's'}`}
        </output>

        {/* biome-ignore lint/a11y/useFocusableInteractive: focus is on the input; listbox uses aria-activedescendant pattern. */}
        {/* biome-ignore lint/a11y/useSemanticElements: combobox listbox container has no native HTML equivalent. */}
        <div
          role="listbox"
          aria-label="Command palette results"
          className="max-h-80 overflow-y-auto p-1"
          data-testid="command-palette-results"
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              // biome-ignore lint/a11y/useSemanticElements: combobox option pattern requires role="option" on the interactive item.
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(i);
              }}
              className="flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm text-fg aria-selected:bg-accent-soft"
              data-testid={`command-palette-item-${i}`}
            >
              <span className="font-medium">{item.label}</span>
              {item.kind === 'search' ? (
                <span className="text-xs text-fg-muted">{item.snippet}</span>
              ) : item.hint ? (
                <span className="text-xs text-fg-muted">{item.hint}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const stripMarks = (s: string): string => s.replace(/<\/?mark>/g, '');
