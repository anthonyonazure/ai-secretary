import { useLiveCaptions } from '../../../hooks/use-live-captions';

/**
 * Story 4.6 — live captions strip for the recording surface.
 *
 * Renders inside the recording-controller when the user enables the
 * "Show captions" toggle. Semantic HTML — `<output>` with
 * `aria-live="polite"` so assistive tech announces partial transcripts
 * without barging interim updates. Defaults to the locked accessible-
 * density token surface (44px touch target on the toggle, larger
 * leading + more whitespace on the caption text).
 *
 * When the browser's SpeechRecognition isn't available the component
 * falls back to an explainer line — captions don't BLOCK recording
 * because the post-upload transcript still lands.
 */

export interface LiveCaptionsProps {
  /** Pass `true` to start captions on mount; the recording-controller
   *  flips this when the user toggles the captions UI. */
  active: boolean;
  /** Optional override for the BCP-47 language tag. Defaults to en-US. */
  language?: string;
}

export function LiveCaptions({ active, language }: LiveCaptionsProps) {
  const { state, start, stop } = useLiveCaptions(language ?? 'en-US');

  // Mirror the `active` prop into the recognition lifecycle.
  if (active && state.kind === 'idle') {
    queueMicrotask(start);
  } else if (!active && (state.kind === 'listening' || state.kind === 'starting')) {
    queueMicrotask(stop);
  }

  if (!active) return null;

  if (state.kind === 'unsupported') {
    return (
      <output
        className="block rounded-md border border-border bg-surface p-3 text-sm text-fg-muted"
        data-testid="live-captions-unsupported"
      >
        {state.reason}
      </output>
    );
  }

  if (state.kind === 'error') {
    return (
      <div
        role="alert"
        className="rounded-md border border-danger bg-surface p-3 text-sm text-danger"
        data-testid="live-captions-error"
      >
        Captions paused — {state.reason}. The post-recording transcript will still land.
      </div>
    );
  }

  const finalText = state.kind === 'listening' ? state.finalText : '';
  const partial = state.kind === 'listening' ? state.partial : '';

  return (
    <output
      aria-live="polite"
      aria-atomic="false"
      className="block rounded-md border border-border bg-surface p-4 text-fg leading-loose"
      data-testid="live-captions"
    >
      <span className="block text-base font-sans">{finalText}</span>
      {partial ? (
        <span className="mt-1 block text-base text-fg-muted italic" data-partial>
          {partial}
        </span>
      ) : null}
      {!finalText && !partial ? <span className="text-sm text-fg-muted">Listening…</span> : null}
    </output>
  );
}
