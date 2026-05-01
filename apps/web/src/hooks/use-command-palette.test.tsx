import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCommandPalette } from './use-command-palette';

const fireKey = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
  // jsdom won't run preventDefault meaningfully; just dispatch.
  window.dispatchEvent(event);
  return event;
};

describe('useCommandPalette', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.open).toBe(false);
  });

  it('opens on Cmd+K', () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      fireKey({ key: 'k', metaKey: true });
    });
    expect(result.current.open).toBe(true);
  });

  it('opens on Ctrl+K (Linux/Windows)', () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      fireKey({ key: 'K', ctrlKey: true });
    });
    expect(result.current.open).toBe(true);
  });

  it('toggles open then closed on repeated shortcut', () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      fireKey({ key: 'k', metaKey: true });
    });
    expect(result.current.open).toBe(true);
    act(() => {
      fireKey({ key: 'k', metaKey: true });
    });
    expect(result.current.open).toBe(false);
  });

  it('close() returns the hook to closed state', () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
  });
});
