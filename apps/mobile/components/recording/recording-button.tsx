/**
 * RN counterpart to the web RecordingButton. Pressable surface; same
 * variant table so visual parity holds across web + native.
 */

import { Pressable, Text } from 'react-native';
import type { RecordingMachineState } from '../../hooks/use-recording-state-machine';

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
  const handler = pickHandler(state, onStart, onStop, onRetry);
  const isDisabled = disabled || handler === undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={variant.label}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={handler}
      className={`min-h-11 flex-row items-center justify-center gap-2 rounded-md px-4 py-2 ${variant.className} ${isDisabled ? 'opacity-50' : ''}`}
    >
      <Text accessibilityElementsHidden className={variant.glyphClass}>
        {variant.glyph}
      </Text>
      <Text className={variant.textClass}>{variant.label}</Text>
    </Pressable>
  );
}

function describeVariant(state: RecordingMachineState): {
  label: string;
  glyph: string;
  className: string;
  textClass: string;
  glyphClass: string;
} {
  switch (state.kind) {
    case 'idle':
      return {
        label: 'Start recording',
        glyph: '●',
        className: 'bg-accent',
        textClass: 'text-sm font-medium text-bg',
        glyphClass: 'text-bg',
      };
    case 'requesting-consent':
      return {
        label: 'Awaiting consent…',
        glyph: '…',
        className: 'bg-accent-soft',
        textClass: 'text-sm text-fg-muted',
        glyphClass: 'text-fg-muted',
      };
    case 'recording':
    case 'paused':
      return {
        label: 'Stop recording',
        glyph: '■',
        className: 'bg-fg',
        textClass: 'text-sm font-medium text-bg',
        glyphClass: 'text-bg',
      };
    case 'stopping':
      return {
        label: 'Stopping…',
        glyph: '…',
        className: 'bg-accent-soft',
        textClass: 'text-sm text-fg-muted',
        glyphClass: 'text-fg-muted',
      };
    case 'uploading':
      return {
        label: `Uploading ${Math.round(state.progress * 100)}%`,
        glyph: '↑',
        className: 'bg-accent-soft',
        textClass: 'text-sm text-fg-muted',
        glyphClass: 'text-fg-muted',
      };
    case 'error':
      return {
        label: state.retryable ? 'Retry recording' : 'Recording failed',
        glyph: '!',
        className: 'border border-border bg-surface',
        textClass: 'text-sm text-fg',
        glyphClass: 'text-fg',
      };
    default: {
      const _exhaustive: never = state;
      void _exhaustive;
      return {
        label: 'Record',
        glyph: '●',
        className: 'bg-accent',
        textClass: 'text-sm font-medium text-bg',
        glyphClass: 'text-bg',
      };
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
