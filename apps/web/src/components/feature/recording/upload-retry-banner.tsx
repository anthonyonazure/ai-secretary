/**
 * Upload retry banner — Story 4.5 escalation surface.
 *
 * Shown when the resumable-upload state machine reaches `error` with
 * `reason: 'upload-retry-exhausted'`. Three actions:
 *
 *   1. "Retry now"      — re-invokes the upload; budget resets.
 *   2. "Upload manually" — opens the device file-picker so the user
 *                          can save the recording bytes locally for
 *                          later upload (or hand off to support).
 *   3. "Contact support" — mailto: with prefilled subject + recordingId.
 *
 * Accessibility:
 *   - `role="alert"` so a screen reader announces the failure
 *     immediately on mount (the FSM transition gates rendering, so the
 *     mount IS the announcement signal).
 *   - Auto-focus the primary action so keyboard users can act with
 *     <Enter> after the announcement.
 *   - Min 44px touch target on every button (per UX spec § 4.4).
 */

import { useEffect, useRef } from 'react';

export interface UploadRetryBannerProps {
  /** Recording id — surfaced in the support email body. */
  recordingId: string;
  /** Last error message — surfaced in the support email body. */
  lastErrorMessage?: string;
  /** Re-invoke the upload from a fresh budget window. */
  onRetry: () => void;
  /**
   * "Upload manually" — caller wires this to a download-blob /
   * save-file-locally flow. The component only triggers it.
   */
  onUploadManually: () => void;
  /**
   * Optional override for the support email address. Defaults to the
   * generic support@aisecretary.app inbox.
   */
  supportEmail?: string;
  /**
   * When true (default), the primary action receives focus on mount.
   * Storybook's `Default` story disables this so multiple stories on
   * one page don't fight for focus.
   */
  autoFocus?: boolean;
}

const DEFAULT_SUPPORT_EMAIL = 'support@aisecretary.app';

const BUTTON_BASE =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-4 py-2 ' +
  'font-sans text-sm font-medium shadow-sm focus:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export function UploadRetryBanner({
  recordingId,
  lastErrorMessage,
  onRetry,
  onUploadManually,
  supportEmail = DEFAULT_SUPPORT_EMAIL,
  autoFocus = true,
}: UploadRetryBannerProps) {
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (autoFocus) retryButtonRef.current?.focus();
  }, [autoFocus]);

  const subject = `Upload failed for recording ${recordingId}`;
  const lines = [
    'Hi AI Secretary support,',
    '',
    `My upload for recording ${recordingId} did not finish after 10 minutes of retries.`,
    lastErrorMessage ? `Last error: ${lastErrorMessage}` : '',
    '',
    'Please advise on next steps. Thank you.',
  ].filter(Boolean);
  const mailto = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;

  return (
    <div
      role="alert"
      data-testid="upload-retry-banner"
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
    >
      <div className="flex flex-col gap-1">
        <p className="font-sans text-sm font-medium text-fg">Your upload didn&apos;t finish.</p>
        <p className="font-sans text-sm text-fg-muted">
          We tried for 10 minutes. Your recording is still saved on this device — try again or pick
          another option.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          ref={retryButtonRef}
          type="button"
          onClick={onRetry}
          className={`${BUTTON_BASE} bg-accent text-fg-on-accent hover:opacity-90`}
        >
          Retry now
        </button>
        <button
          type="button"
          onClick={onUploadManually}
          className={`${BUTTON_BASE} bg-bg text-fg ring-1 ring-border hover:bg-surface-hover`}
        >
          Upload manually
        </button>
        <a
          href={mailto}
          className={`${BUTTON_BASE} bg-bg text-fg ring-1 ring-border hover:bg-surface-hover`}
        >
          Contact support
        </a>
      </div>
    </div>
  );
}
