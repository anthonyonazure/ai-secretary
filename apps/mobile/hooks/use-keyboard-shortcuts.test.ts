import { describe, expect, it } from 'vitest';

import { buildShortcuts, detectPlatform, matchKeyboardShortcut } from './use-keyboard-shortcuts.js';

const ev = (
  overrides: Partial<
    Parameters<ReturnType<typeof buildShortcuts>['open-palette']['matches']>[0]
  > = {},
): Parameters<ReturnType<typeof buildShortcuts>['open-palette']['matches']>[0] => ({
  key: 'a',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
});

describe('detectPlatform', () => {
  it('returns "mac" for a macOS UA', () => {
    expect(detectPlatform('Mozilla/5.0 (Macintosh)')).toBe('mac');
  });

  it('returns "win" for a Windows UA', () => {
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0)')).toBe('win');
  });

  it('returns "linux" for a Linux UA', () => {
    expect(detectPlatform('Mozilla/5.0 (X11; Linux)')).toBe('linux');
  });

  it('returns "native" when no UA is available', () => {
    expect(detectPlatform(null)).toBe('native');
  });
});

describe('buildShortcuts', () => {
  it('uses ⌘ on mac and Ctrl on win', () => {
    expect(buildShortcuts('mac')['open-palette'].label).toBe('⌘K');
    expect(buildShortcuts('win')['open-palette'].label).toBe('CtrlK');
  });

  it('matches cmd+K on mac', () => {
    const shortcuts = buildShortcuts('mac');
    expect(shortcuts['open-palette'].matches(ev({ key: 'k', metaKey: true }))).toBe(true);
    expect(shortcuts['open-palette'].matches(ev({ key: 'k', ctrlKey: true }))).toBe(false);
  });

  it('matches ctrl+K on win', () => {
    const shortcuts = buildShortcuts('win');
    expect(shortcuts['open-palette'].matches(ev({ key: 'k', ctrlKey: true }))).toBe(true);
    expect(shortcuts['open-palette'].matches(ev({ key: 'k', metaKey: true }))).toBe(false);
  });
});

describe('matchKeyboardShortcut', () => {
  it('returns "open-palette" for cmd+K on mac', () => {
    expect(matchKeyboardShortcut(ev({ key: 'k', metaKey: true }), 'mac')).toBe('open-palette');
  });

  it('returns "stop-recording" for Escape', () => {
    expect(matchKeyboardShortcut(ev({ key: 'Escape' }), 'mac')).toBe('stop-recording');
  });

  it('returns "focus-search" for unmodified slash', () => {
    expect(matchKeyboardShortcut(ev({ key: '/' }), 'mac')).toBe('focus-search');
  });

  it('returns "submit-form" for cmd+Enter', () => {
    expect(matchKeyboardShortcut(ev({ key: 'Enter', metaKey: true }), 'mac')).toBe('submit-form');
  });

  it('returns null when nothing matches', () => {
    expect(matchKeyboardShortcut(ev({ key: 'a' }), 'mac')).toBeNull();
  });

  it('does NOT trigger focus-search when alt is held', () => {
    expect(matchKeyboardShortcut(ev({ key: '/', altKey: true }), 'mac')).toBeNull();
  });
});
