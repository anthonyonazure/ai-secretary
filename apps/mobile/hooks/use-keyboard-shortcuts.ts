/**
 * `matchKeyboardShortcut` — pure helper for the cmd-K command palette
 * + the recording controller's hotkeys. Wraps platform-detection
 * (`navigator.userAgent` on web; static on RN) so screens render the
 * right modifier label and dispatch the right action.
 */

export type KeyboardEventLike = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

export type ShortcutPlatform = 'mac' | 'win' | 'linux' | 'native';

export type ShortcutBinding = {
  /** Display label, e.g. "⌘K" / "Ctrl+K". */
  label: string;
  /** Match function — true when this event fires the shortcut. */
  matches: (event: KeyboardEventLike) => boolean;
};

export type ShortcutId =
  | 'open-palette'
  | 'start-recording'
  | 'stop-recording'
  | 'focus-search'
  | 'submit-form'
  | 'cancel';

export const detectPlatform = (userAgent: string | null): ShortcutPlatform => {
  if (userAgent === null) return 'native';
  const ua = userAgent.toLowerCase();
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('win')) return 'win';
  if (ua.includes('linux')) return 'linux';
  return 'win';
};

const isPrimary = (e: KeyboardEventLike, platform: ShortcutPlatform): boolean =>
  platform === 'mac' ? e.metaKey : e.ctrlKey;

export const buildShortcuts = (platform: ShortcutPlatform): Record<ShortcutId, ShortcutBinding> => {
  const cmd = platform === 'mac' ? '⌘' : 'Ctrl';
  return {
    'open-palette': {
      label: `${cmd}K`,
      matches: (e) => isPrimary(e, platform) && e.key.toLowerCase() === 'k',
    },
    'start-recording': {
      label: `${cmd}R`,
      matches: (e) => isPrimary(e, platform) && e.shiftKey && e.key.toLowerCase() === 'r',
    },
    'stop-recording': {
      label: 'Esc',
      matches: (e) => e.key === 'Escape',
    },
    'focus-search': {
      label: '/',
      matches: (e) => e.key === '/' && !isPrimary(e, platform) && !e.altKey,
    },
    'submit-form': {
      label: `${cmd}↩`,
      matches: (e) => isPrimary(e, platform) && e.key === 'Enter',
    },
    cancel: {
      label: 'Esc',
      matches: (e) => e.key === 'Escape',
    },
  };
};

export const matchKeyboardShortcut = (
  event: KeyboardEventLike,
  platform: ShortcutPlatform,
): ShortcutId | null => {
  const bindings = buildShortcuts(platform);
  for (const id of Object.keys(bindings) as ShortcutId[]) {
    if (bindings[id].matches(event)) return id;
  }
  return null;
};
