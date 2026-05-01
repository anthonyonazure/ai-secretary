/**
 * One-tap recording entry. Renders idle / recording / paused / uploading /
 * error states from a single button surface — pressing flips into the
 * matching transition. Visually distinct from `RecordingStatusPill` (status
 * primitive); this is the action primitive.
 */

import type { RecordingMachineState } from '../../../hooks/use-recording-state-machine';

export interface RecordingButtonProps {
  state: RecordingMachineState;
  onStart: () => void;
  onStop: () => void;
  onRetry?: () => void;
  disabled?: boolean;
}

export function RecordingButton({
  state,
  onStart,
  onStop,
  onRetry,
  disabled,
}: RecordingButtonProps) {
  const variant = describeVariant(state);
  const label = variant.label;
  const handler = pickHandler(state, onStart, onStop, onRetry);
  return (
    <button
      type="button"
      onClick={handler}
      disabled={disabled || handler === undefined}
      aria-label={label}
      data-state={state.kind}
      className={[
        'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-4 py-2',
        'font-sans text-sm font-medium shadow-sm',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant.className,
      ].join(' ')}
    >
      <span aria-hidden="true">{variant.glyph}</span>
      <span>{variant.label}</span>
    </button>
  );
}

function describeVariant(state: RecordingMachineState): {
  label: string;
  glyph: string;
  className: string;
} {
  switch (state.kind) {
    case 'idle':
      return {
        label: 'Start recording',
        glyph: '●',
        className: 'bg-accent text-bg hover:opacity-90',
      };
    case 'requesting-consent':
      return {
        label: 'Awaiting consent…',
        glyph: '…',
        className: 'bg-accent-soft text-fg-muted',
      };
    case 'recording':
      return {
        label: 'Stop recording',
        glyph: '■',
        className: 'bg-fg text-bg hover:opacity-90',
      };
    case 'paused':
      return {
        label: 'Stop recording',
        glyph: '■',
        className: 'bg-fg text-bg hover:opacity-90',
      };
    case 'stopping':
      return {
        label: 'Stopping…',
        glyph: '…',
        className: 'bg-accent-soft text-fg-muted',
      };
    case 'uploading':
      return {
        label: `Uploading ${Math.round(state.progress * 100)}%`,
        glyph: '↑',
        className: 'bg-accent-soft text-fg-muted',
      };
    case 'error':
      return {
        label: state.retryable ? 'Retry recording' : 'Recording failed',
        glyph: '!',
        className: 'border border-border bg-surface text-fg hover:bg-accent-soft',
      };
    default: {
      const _exhaustive: never = state;
      void _exhaustive;
      return { label: 'Record', glyph: '●', className: 'bg-accent text-bg' };
    }
  }
}

function pickHandler(
  state: RecordingMachineState,
  onStart: () => void,
  onStop: () => void,
  onRetry?: () => void,
): (() => void) | undefined {
  switch (state.kind) {
    case 'idle':
      return onStart;
    case 'recording':
    case 'paused':
      return onStop;
    case 'error':
      return onRetry ?? onStart;
    case 'requesting-consent':
    case 'stopping':
    case 'uploading':
      return undefined;
    default:
      return undefined;
  }
}
