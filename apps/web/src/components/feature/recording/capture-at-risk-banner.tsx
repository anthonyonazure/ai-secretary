/**
 * `CaptureAtRiskBanner` — Story 4.4 surface.
 *
 * Renders inside the recording controller when the heartbeat
 * watchdog detects a lost ping (90s threshold). Per UX spec:
 *   - role="alert" + aria-live="assertive" — this is the ONE
 *     assertive surface in the app (everything else is polite)
 *   - Three CTAs: keep recording (force-extend), pause, end
 *   - Plain-language copy — explains what's happening + what user
 *     can do
 *
 * Anti-pattern guarded against (UX spec § Step 5 #4): notification
 * anxiety. The banner is dismissible per-instance; it doesn't
 * lock the user out of the recording UI.
 */

import { AlertTriangle, Pause, Square, ZapOff } from 'lucide-react';

export interface CaptureAtRiskBannerProps {
  /**
   * Seconds since the last successful heartbeat. Drives the urgency
   * copy ("90s ago" vs "5 minutes ago").
   */
  secondsSinceLastPing: number;
  onContinue: () => void;
  onPause: () => void;
  onStop: () => void;
  onDismiss?: () => void;
}

const formatStaleness = (seconds: number): string => {
  if (seconds < 90) return 'just now';
  if (seconds < 60 * 5) return `${Math.floor(seconds / 60)} min ago`;
  return `${Math.floor(seconds / 60)} min ago`;
};

export function CaptureAtRiskBanner({
  secondsSinceLastPing,
  onContinue,
  onPause,
  onStop,
  onDismiss,
}: CaptureAtRiskBannerProps) {
  return (
    <section
      role="alert"
      aria-live="assertive"
      className="flex flex-col gap-3 rounded-md border border-warning bg-warning/10 p-4 text-fg"
      data-testid="capture-at-risk-banner"
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warning/20 text-warning"
        >
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-warning">We may be losing your recording</h3>
          <p className="mt-1 text-sm text-fg-muted">
            We haven't heard from your microphone in {formatStaleness(secondsSinceLastPing)}. The
            bytes already captured are saved — but new audio may not reach us. Continue, pause, or
            stop now.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-bg hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="capture-at-risk-continue"
        >
          <ZapOff className="h-4 w-4" aria-hidden="true" />
          Try to continue
        </button>
        <button
          type="button"
          onClick={onPause}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-sm text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="capture-at-risk-pause"
        >
          <Pause className="h-4 w-4" aria-hidden="true" />
          Pause
        </button>
        <button
          type="button"
          onClick={onStop}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-danger bg-bg px-3 text-sm text-danger hover:bg-danger/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          data-testid="capture-at-risk-stop"
        >
          <Square className="h-4 w-4" aria-hidden="true" />
          Stop now
        </button>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto inline-flex h-9 items-center rounded-md px-3 text-xs text-fg-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="capture-at-risk-dismiss"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </section>
  );
}
