/**
 * `deriveShareLinkCopyState` — UX state for the "copy share link" button.
 *
 * Shows the copy button → on click, attempts the clipboard write → renders
 * a "Copied!" confirmation for 2 seconds → returns to the idle state.
 *
 * Pure helper. The host wires `navigator.clipboard.writeText` (web) or
 * `expo-clipboard.setStringAsync` (native).
 */

export type ShareLinkCopyInput = {
  link: string | null;
  copiedAtMs: number | null;
  errorAtMs: number | null;
  errorMessage: string | null;
  now?: number;
};

export type ShareLinkCopyState = {
  buttonLabel: string;
  buttonEnabled: boolean;
  showConfirmation: boolean;
  showError: boolean;
  errorCopy: string | null;
};

const CONFIRMATION_WINDOW_MS = 2_000;
const ERROR_WINDOW_MS = 4_000;

export const deriveShareLinkCopyState = (input: ShareLinkCopyInput): ShareLinkCopyState => {
  const now = input.now ?? Date.now();
  const linkAvailable = input.link !== null && input.link.length > 0;
  const errorActive = input.errorAtMs !== null && now - input.errorAtMs < ERROR_WINDOW_MS;
  const copiedActive = input.copiedAtMs !== null && now - input.copiedAtMs < CONFIRMATION_WINDOW_MS;

  if (errorActive) {
    return {
      buttonLabel: 'Try again',
      buttonEnabled: linkAvailable,
      showConfirmation: false,
      showError: true,
      errorCopy: input.errorMessage ?? 'Could not copy. Long-press the link to copy manually.',
    };
  }
  if (copiedActive) {
    return {
      buttonLabel: 'Copied!',
      buttonEnabled: false,
      showConfirmation: true,
      showError: false,
      errorCopy: null,
    };
  }
  return {
    buttonLabel: 'Copy link',
    buttonEnabled: linkAvailable,
    showConfirmation: false,
    showError: false,
    errorCopy: null,
  };
};
