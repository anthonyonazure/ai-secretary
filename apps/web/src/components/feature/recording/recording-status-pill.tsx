import { useMemo } from 'react';

import {
  type RecordingTimer,
  describeAriaSeconds,
  useRecordingTimer,
} from '@aisecretary/shared/hooks/use-recording-timer';

import './recording-status-pill.css';

export type RecordingState = 'idle' | 'recording' | 'paused';

export interface RecordingDevice {
  name: string;
  type: 'builtin' | 'bluetooth' | 'usb';
}

export type RecordingStatusPillVariant = 'compact' | 'standard' | 'with-device';

export interface RecordingStatusPillProps {
  state: RecordingState;
  elapsedSeconds: number;
  device?: RecordingDevice;
  variant?: RecordingStatusPillVariant;
  onStop?: () => void;
}

/**
 * V2 inline-waveform recording-status primitive (UX spec U1, FR11).
 *
 * Single visual primitive used identically across browser tab pill, embed
 * surfaces, and the desktop header (mobile lock-screen + bot-status-row are
 * RN/server-rendered counterparts that consume the same contract). V1
 * pulse-dot and V3 gradient-ring are discarded.
 *
 * `state="idle"` renders nothing — the pill is mounted but invisible until
 * a recording starts. This keeps the slot stable across `AppShell.*`
 * variants.
 */
export function RecordingStatusPill({
  state,
  elapsedSeconds,
  device,
  variant = 'standard',
  onStop,
}: RecordingStatusPillProps) {
  const isActive = state === 'recording';
  const timer = useRecordingTimer(elapsedSeconds, isActive);

  if (state === 'idle') return null;

  const ariaLabel = useAriaLabel(state, timer, device);
  const showDevice = variant === 'with-device' && device !== undefined;

  return (
    <output
      aria-live="polite"
      aria-label={ariaLabel}
      data-state={state}
      data-variant={variant}
      className={pillClasses(variant)}
    >
      <Waveform paused={state === 'paused'} />
      <span className="font-sans text-sm font-medium text-fg leading-tight">
        {state === 'paused' ? 'Paused' : 'Recording'}
      </span>
      <span className="font-mono text-sm tabular-nums text-fg leading-tight">{timer.display}</span>
      {showDevice ? <DeviceChip device={device} /> : null}
      {onStop ? (
        <button
          type="button"
          onClick={onStop}
          className="ml-1 inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-xs font-medium text-fg-muted hover:text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          aria-label={state === 'paused' ? 'Stop recording' : 'Stop recording'}
        >
          Stop
        </button>
      ) : null}
    </output>
  );
}

function pillClasses(variant: RecordingStatusPillVariant): string {
  // Touch-target floor of 44px (AAA per Step 8 / arch-addendums § density).
  // The `min-h-11` (44px in default density) holds even when the visible
  // pill is smaller — extra padding becomes hit area.
  const base =
    'inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 py-1 shadow-sm z-recording-status';
  if (variant === 'compact') {
    return `${base} max-w-fit`;
  }
  return base;
}

function Waveform({ paused }: { paused: boolean }) {
  // Five bars; the CSS keyframes in recording-status-pill.css drive the
  // animation. When paused, we neutralize the animation by overriding
  // animation-play-state via a data attribute the CSS picks up.
  return (
    <span
      aria-hidden="true"
      data-paused={paused ? 'true' : 'false'}
      className="inline-flex h-5 items-end gap-[2px]"
      style={paused ? { animationPlayState: 'paused' } : undefined}
    >
      {[1, 2, 3, 4, 5].map((bar) => (
        <span key={bar} data-rsp-bar={bar} className="block h-full w-[3px] rounded-sm bg-accent" />
      ))}
    </span>
  );
}

function DeviceChip({ device }: { device: RecordingDevice }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-accent-soft px-2 py-0.5 text-xs text-fg-muted">
      <DeviceGlyph type={device.type} />
      <span className="max-w-[12ch] truncate">{device.name}</span>
    </span>
  );
}

function DeviceGlyph({ type }: { type: RecordingDevice['type'] }) {
  // Lucide icons would land here once the icon set is wired in Story 1.6.
  // Until then, single-character placeholders keep the chip readable.
  const glyph = type === 'bluetooth' ? '⌁' : type === 'usb' ? '◎' : '◉';
  return <span aria-hidden="true">{glyph}</span>;
}

function useAriaLabel(
  state: RecordingState,
  timer: RecordingTimer,
  device: RecordingDevice | undefined,
): string {
  return useMemo(() => {
    const verb = state === 'paused' ? 'Recording paused' : 'Recording';
    const duration = describeAriaSeconds(timer.ariaSeconds);
    const deviceClause = device ? `, via ${device.name}` : '';
    return `${verb}, ${duration}${deviceClause}`;
  }, [state, timer.ariaSeconds, device]);
}
