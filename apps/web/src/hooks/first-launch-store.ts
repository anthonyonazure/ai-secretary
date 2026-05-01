/**
 * First-launch state store — Story 1.7.
 *
 * Tracks the local-first state required to drive the F2 user-first-
 * launch polish surface (UX spec §). Three shape concerns:
 *
 *   1. `receiptsViewed` — count of distinct meeting receipts the user
 *      has visited. After the third receipt the polish surface dials
 *      back to the calm default.
 *   2. `thumbsResponses` — meetingId → 'up' | 'down' map; lets the
 *      ThumbsPrompt suppress itself once the user has answered for a
 *      given meeting (and gives the receipt page a deterministic
 *      "already responded" branch without an extra API call).
 *   3. `reEngagementSuppressedUntil` — millis-since-epoch cutoff for
 *      the 30d cooldown when the user explicitly opts out of follow-
 *      up emails. Server-side enforcement happens via the gateway's
 *      dedup-key rules; this is the client-side hint surface.
 *
 * Persisted to localStorage so the polish doesn't re-fire if the user
 * refreshes mid-onboarding. The persistence-layer shim added by Story
 * 1.6 in `apps/web/src/test/setup.ts` covers it under jsdom.
 *
 * TODO(future Story): server-side first-launch state on the user row
 * when settings sync ships — at that point this becomes a cache shim.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThumbsResponseValue = 'up' | 'down';

interface FirstLaunchState {
  /** Distinct meeting ids the user has visited (used to dedupe count). */
  viewedMeetingIds: string[];
  receiptsViewed: number;
  thumbsResponses: Record<string, ThumbsResponseValue>;
  reEngagementSuppressedUntil: number | null;
  markReceiptViewed(meetingId: string): void;
  recordThumbs(meetingId: string, response: ThumbsResponseValue): void;
  suppressReEngagement(durationMs: number): void;
  reset(): void;
}

const FIRST_LAUNCH_STORAGE_KEY = 'aisecretary.first-launch';

export const useFirstLaunchStore = create<FirstLaunchState>()(
  persist(
    (set) => ({
      viewedMeetingIds: [],
      receiptsViewed: 0,
      thumbsResponses: {},
      reEngagementSuppressedUntil: null,
      markReceiptViewed: (meetingId) =>
        set((state) => {
          if (state.viewedMeetingIds.includes(meetingId)) {
            return state;
          }
          const next = [...state.viewedMeetingIds, meetingId];
          return {
            ...state,
            viewedMeetingIds: next,
            receiptsViewed: next.length,
          };
        }),
      recordThumbs: (meetingId, response) =>
        set((state) => ({
          ...state,
          thumbsResponses: { ...state.thumbsResponses, [meetingId]: response },
        })),
      suppressReEngagement: (durationMs) =>
        set((state) => ({
          ...state,
          reEngagementSuppressedUntil: Date.now() + durationMs,
        })),
      reset: () =>
        set({
          viewedMeetingIds: [],
          receiptsViewed: 0,
          thumbsResponses: {},
          reEngagementSuppressedUntil: null,
        }),
    }),
    { name: FIRST_LAUNCH_STORAGE_KEY },
  ),
);

/**
 * Selector for the polish surface — true while the user is on receipts
 * 1, 2 or 3. After the third the surface dials back to calm.
 */
export function useIsFirstThreeReceipts(): boolean {
  return useFirstLaunchStore((s) => s.receiptsViewed < 3);
}

/** Selector — true if the user has already responded for this meeting. */
export function useHasRespondedToThumbs(meetingId: string): boolean {
  return useFirstLaunchStore((s) => meetingId in s.thumbsResponses);
}

export const FIRST_LAUNCH_STORAGE_KEY_FOR_TEST = FIRST_LAUNCH_STORAGE_KEY;
