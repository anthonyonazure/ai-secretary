/**
 * Command palette (cmd-K) — Story 1.6 placeholder.
 *
 * UX spec calls for a global cmd-K palette that opens from anywhere on
 * web (`⌘K` on macOS, `Ctrl+K` elsewhere). The full palette — fuzzy
 * search across meetings, modules, settings, RAG chat — lives in Epic
 * 7 (search). For now, this component:
 *
 *   1. Owns open / close state via Radix Dialog
 *   2. Catches the global `⌘K` / `Ctrl+K` shortcut
 *   3. Renders an empty input + a hint string explaining it's wired
 *      but not yet populated
 *
 * Once Epic 7 lands, the search results list slots in below the input
 * without changing the surrounding chrome.
 */

import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface CommandPaletteProps {
  /** Controlled-open mode — used by stories + tests. */
  open?: boolean;
  /** Open-state setter for controlled mode. */
  onOpenChange?: (open: boolean) => void;
  /** Disables the global keybinding listener — useful in stories. */
  disableShortcut?: boolean;
}

export function CommandPalette({
  open: controlledOpen,
  onOpenChange,
  disableShortcut,
}: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const inputRef = useRef<HTMLInputElement>(null);
  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (controlledOpen === undefined) setInternalOpen(next);
    },
    [controlledOpen, onOpenChange],
  );

  useEffect(() => {
    if (disableShortcut) return;
    const handler = (event: KeyboardEvent) => {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      if (isCmdOrCtrl && (event.key === 'k' || event.key === 'K')) {
        event.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [disableShortcut, open, setOpen]);

  // Focus the search input when the dialog opens. Using a ref + effect
  // keeps biome's `noAutofocus` rule happy while still landing focus
  // where users expect it for cmd-K.
  useEffect(() => {
    if (open) {
      // Defer one frame so Radix has finished mounting the portal.
      const id = window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-modal-backdrop bg-black/40" />
        <Dialog.Content
          aria-label="Command palette"
          className="fixed left-1/2 top-24 z-modal w-full max-w-xl -translate-x-1/2 rounded-md border border-border bg-surface shadow-lg focus:outline-none"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Command className="h-4 w-4 text-fg-muted" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search meetings, actions, settings…"
              aria-label="Search"
              className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
            />
            <kbd className="rounded-sm border border-border bg-bg px-1.5 py-0.5 text-xs text-fg-muted">
              esc
            </kbd>
          </div>
          <div className="px-4 py-6 text-center text-sm text-fg-muted">
            Search lands in Epic 7 — for now, use the sidebar nav to jump between Inbox, Record, and
            Settings.
          </div>
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search meetings, actions, and settings.
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Trigger button for the palette — hosted in the inbox-shell header.
 * Shows the platform-appropriate keybinding hint.
 */
export function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const modifier = isMac ? '⌘' : 'Ctrl';
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open command palette"
      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg px-3 text-sm text-fg-muted hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
    >
      <Command className="h-4 w-4" aria-hidden="true" />
      <span>Search</span>
      <kbd className="rounded-sm border border-border bg-surface px-1.5 py-0.5 text-xs">
        {modifier}K
      </kbd>
    </button>
  );
}
