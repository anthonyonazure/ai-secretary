/**
 * Global recording-state store — Story 1.6.
 *
 * The `RecordingStatusPill` lives top-right of every shell, ALWAYS (UX
 * spec U1). Pre-1.6 the pill was mounted inside `RecordingController`
 * alongside the action button. Story 1.6 hoists the pill into
 * `AppShellFrame` so it's visible regardless of the active route.
 *
 * To avoid restructuring `RecordingController` (which owns the
 * authoritative state machine in `use-recording-state-machine.ts`), the
 * controller pushes derived state into this Zustand store on every
 * render. The shell's pill subscribes and renders. Both surfaces stay
 * in sync because the controller is the only writer.
 *
 * `useSyncRecordingPill` is the publisher hook — `RecordingController`
 * calls it once per render. `useRecordingPillState` is the read API,
 * consumed by `AppShellFrame`.
 *
 * Sticking with a shared Zustand store (instead of, say, lifting state
 * up via context) keeps the contract simple: any future surface that
 * wants to mirror recording state — e.g. the bot-status row in F8 —
 * can subscribe to the same store without re-architecting the
 * controller.
 */

import { useEffect } from 'react';
import { create } from 'zustand';
import type { RecordingState as PillState, RecordingDevice } from './recording-status-pill';

interface RecordingPillStoreState {
  state: PillState;
  elapsedSeconds: number;
  device: RecordingDevice | undefined;
  set: (next: {
    state: PillState;
    elapsedSeconds: number;
    device?: RecordingDevice | undefined;
  }) => void;
  reset: () => void;
}

const INITIAL = {
  state: 'idle' as const,
  elapsedSeconds: 0,
  device: undefined,
};

export const useRecordingPillStore = create<RecordingPillStoreState>()((set) => ({
  ...INITIAL,
  set: (next) =>
    set({
      state: next.state,
      elapsedSeconds: next.elapsedSeconds,
      device: next.device,
    }),
  reset: () => set(INITIAL),
}));

/**
 * Read API for the shell's pill slot.
 */
export function useRecordingPillState(): {
  state: PillState;
  elapsedSeconds: number;
  device: RecordingDevice | undefined;
} {
  const state = useRecordingPillStore((s) => s.state);
  const elapsedSeconds = useRecordingPillStore((s) => s.elapsedSeconds);
  const device = useRecordingPillStore((s) => s.device);
  return { state, elapsedSeconds, device };
}

/**
 * Publisher hook — call once per render from inside `RecordingController`.
 * On unmount, the store resets so the pill disappears if the controller
 * leaves the tree without going through an explicit stop transition.
 */
export function useSyncRecordingPill(input: {
  state: PillState;
  elapsedSeconds: number;
  device?: RecordingDevice | undefined;
}): void {
  const set = useRecordingPillStore((s) => s.set);
  const reset = useRecordingPillStore((s) => s.reset);

  useEffect(() => {
    set({
      state: input.state,
      elapsedSeconds: input.elapsedSeconds,
      device: input.device,
    });
  }, [set, input.state, input.elapsedSeconds, input.device]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);
}
