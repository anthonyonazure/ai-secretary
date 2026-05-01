/**
 * Hook that wires the global Cmd/Ctrl+K shortcut to a boolean toggle.
 *
 * Caller renders the `<CommandPalette open={...} onClose={...} />`.
 * The hook attaches a window-level keydown listener while mounted.
 *
 * Locked keyboard contract per UX spec § Navigation patterns:
 *   - Cmd+K (mac) / Ctrl+K (everywhere else) toggles
 *   - The listener does NOT trigger when an editable field has focus
 *     unless the input was already part of an opened palette
 */

import { useCallback, useEffect, useState } from 'react';

export interface UseCommandPaletteApi {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  close: () => void;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
};

export function useCommandPalette(): UseCommandPaletteApi {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMacShortcut = e.metaKey && e.key.toLowerCase() === 'k';
      const isLinuxShortcut = e.ctrlKey && e.key.toLowerCase() === 'k';
      if (!isMacShortcut && !isLinuxShortcut) return;
      // Don't hijack the shortcut when the user is in an unrelated
      // editable field (rare but possible — e.g. browser-level
      // password manager dialogs render inputs).
      if (isEditableTarget(e.target) && !open) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return { open, setOpen, toggle, close };
}
