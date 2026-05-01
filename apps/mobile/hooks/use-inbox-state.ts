/**
 * `useInboxState` — mobile inbox derivation.
 *
 * Mirrors the web inbox shell logic but for React Native consumers.
 * Pure derivation lives at the top level so the mobile test runner
 * (no RN renderer) can exercise it.
 *
 * Inbox states (UX spec § Step 4 + § F2 user first-launch):
 *   - 'loading'       — initial fetch
 *   - 'error'         — fetch failed
 *   - 'empty-recipient' — zero meetings: render the "what AI Secretary
 *                        does" sample-library + import-CTA empty state
 *   - 'list'          — non-empty meetings list
 */

export type InboxState = 'loading' | 'error' | 'empty-recipient' | 'list';

export interface InboxStateInput {
  isLoading: boolean;
  isError: boolean;
  meetingCount: number;
}

export const deriveInboxState = (input: InboxStateInput): InboxState => {
  if (input.isLoading) return 'loading';
  if (input.isError) return 'error';
  if (input.meetingCount === 0) return 'empty-recipient';
  return 'list';
};

/**
 * Localized empty-state copy. Kept pure for snapshot testing — the
 * native screen consumes the result via i18next at runtime.
 */
export const emptyStateCopy = (locale: string): { headline: string; cta: string } => {
  if (locale.toLowerCase().startsWith('fr')) {
    return {
      headline: "Bienvenue — voyons ce qu'AI Secretary fait.",
      cta: 'Importer un fichier audio',
    };
  }
  return {
    headline: "Welcome — let's see what AI Secretary does.",
    cta: 'Import an audio file',
  };
};
