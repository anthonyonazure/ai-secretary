import * as Dialog from '@radix-ui/react-dialog';
import { Pause, Play, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { CitationRef, SpeakerTurn } from '@aisecretary/shared';

import { FIXTURE_MEETING_TITLE } from './speaker-turns.fixture';
import { usePlaybackUrl } from './use-playback-url';
import { useSpeakerTurns } from './use-speaker-turns';

/**
 * `TranscriptSeekPlayer` — modal that opens on `CitationChip` click,
 * seeks audio to `spanStartMs - 5000` (clamped at 0), auto-plays, and
 * scrolls the cited turn into view.
 *
 * Spec note: UX spec § "TranscriptSeekPlayer" calls for a custom audio
 * control with a waveform scrubber. Story 3.5 ships the HTML5 `<audio>`
 * element first; the waveform/custom-control polish lands once the
 * recordings pipeline (Story 2.1) wires the presigned-GET URL and we
 * have real audio to render against. Pre-roll seek + play/pause +
 * keyboard control are all in place today.
 *
 * A11y:
 *   - Radix Dialog provides role="dialog", aria-modal="true", focus trap,
 *     Escape closes, overlay click closes
 *   - Cited turn highlighted via `data-active-turn-id` + visual ring
 *   - Spacebar toggles play/pause when focus is anywhere inside the
 *     dialog body (handler attached at the dialog root)
 *   - Reduced-motion: cited turn `scrollIntoView` uses behavior:'auto'
 *     instead of 'smooth'
 *
 * Story 2.1 follow-up landed: `usePlaybackUrl` resolves the meeting →
 * recording → presigned-GET URL chain via the API; `useSpeakerTurns`
 * pulls the diarized turns from the same surface. The hooks return
 * empty-state defaults while loading or when the recording is not yet
 * playable, so the modal renders without audio in those cases instead
 * of failing.
 */

export interface TranscriptSeekPlayerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  citation: CitationRef;
  meetingTitle?: string;
}

const PRE_ROLL_MS = 5_000;

/**
 * Pure pre-roll math. Returns the audio currentTime (in seconds) at which
 * playback should start so the listener hears 5s of context before the
 * cited span. Clamped at 0 for citations within the first 5 seconds.
 *
 * Exported for direct unit tests — jsdom's HTMLMediaElement.currentTime
 * setter is non-functional, which makes integration-level assertions on
 * the seek target unreliable.
 */
export function computeSeekTargetSeconds(spanStartMs: number): number {
  return Math.max(0, (spanStartMs - PRE_ROLL_MS) / 1000);
}

export function TranscriptSeekPlayer({
  open,
  onOpenChange,
  citation,
  meetingTitle,
}: TranscriptSeekPlayerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const turnRefs = useRef<Map<string, HTMLLIElement | null>>(new Map());
  const [activeTurnId, setActiveTurnId] = useState(citation.turnId);
  const [playing, setPlaying] = useState(false);

  const { turns, isLoading } = useSpeakerTurns(citation.meetingId);
  const { url: playbackUrl } = usePlaybackUrl(citation.meetingId);

  const reducedMotion = prefersReducedMotion();

  // When the host changes the cited turn, sync the active highlight.
  useEffect(() => {
    if (open) setActiveTurnId(citation.turnId);
  }, [citation.turnId, open]);

  const seekToTurn = useCallback((turn: SpeakerTurn) => {
    setActiveTurnId(turn.turnId);
    const audio = audioRef.current;
    if (!audio) return;
    const targetSec = computeSeekTargetSeconds(turn.spanStartMs);
    try {
      audio.currentTime = targetSec;
    } catch {
      // Some browsers throw if the source isn't ready yet — the user
      // can press play and the next interaction will set currentTime.
    }
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, []);

  // Auto-scroll + auto-seek on open / activeTurnId change.
  useEffect(() => {
    if (!open || isLoading) return;
    const node = turnRefs.current.get(activeTurnId);
    if (node) {
      node.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    }
  }, [open, activeTurnId, isLoading, reducedMotion]);

  // Initial seek when the dialog first opens. We deliberately fire on
  // the open transition only, not whenever `turns` / `citation.turnId`
  // change — host-driven citation changes flow through the
  // citation-sync effect above, which calls `seekToTurn` via the user
  // tapping a turn instead.
  // biome-ignore lint/correctness/useExhaustiveDependencies: open-transition only
  useEffect(() => {
    if (!open || isLoading) return;
    const initial = turns.find((t) => t.turnId === citation.turnId);
    if (initial) {
      seekToTurn(initial);
    }
  }, [open, isLoading]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        setPlaying(true);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === ' ' && !isInteractiveElement(event.target)) {
      event.preventDefault();
      togglePlayPause();
    }
  };

  // `playbackUrl` is null while the request is in flight or when no
  // completed recording exists. The empty-string fallback keeps the
  // <audio> element mounted (so transcript navigation + a11y still
  // work) without triggering a media-load error.
  const audioSrc = playbackUrl ?? '';

  const headerTitle = meetingTitle ?? FIXTURE_MEETING_TITLE;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm motion-reduced:backdrop-blur-none"
          data-testid="transcript-seek-player-overlay"
        />
        <Dialog.Content
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onKeyDown={handleDialogKeyDown}
          className="fixed left-1/2 top-1/2 z-50 flex h-[min(85vh,40rem)] w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-md border border-border bg-surface shadow-lg focus:outline-none"
          data-testid="transcript-seek-player"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border p-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title
                id={titleId}
                className="font-sans text-base font-semibold leading-tight text-fg"
              >
                {headerTitle}
              </Dialog.Title>
              <Dialog.Description id={descriptionId} className="mt-1 text-xs text-fg-muted">
                {citation.speaker ? `${citation.speaker} · ` : ''}
                {formatTimestamp(citation.spanStartMs)} — playing 5s of context before the cited
                span.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close transcript player"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-fg-muted hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <p className="text-sm text-fg-muted">Loading transcript…</p>
            ) : turns.length === 0 ? (
              <p className="text-sm text-fg-muted">No transcript available for this meeting yet.</p>
            ) : (
              <ol className="space-y-3" data-testid="transcript-turn-list">
                {turns.map((turn) => {
                  const isActive = turn.turnId === activeTurnId;
                  return (
                    <li
                      key={turn.turnId}
                      ref={(node) => {
                        turnRefs.current.set(turn.turnId, node);
                      }}
                      data-active-turn-id={isActive ? turn.turnId : undefined}
                      data-turn-id={turn.turnId}
                      className={`rounded-md border p-3 ${
                        isActive
                          ? 'border-accent bg-accent-soft/40 ring-2 ring-accent'
                          : 'border-border bg-bg'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => seekToTurn(turn)}
                        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
                      >
                        <div className="flex items-center gap-2 text-xs text-fg-muted">
                          <span className="font-semibold text-fg">
                            {turn.speaker ?? 'Unknown speaker'}
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatTimestamp(turn.spanStartMs)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-fg leading-normal">{turn.text}</p>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <footer className="flex items-center gap-3 border-t border-border p-4">
            <button
              type="button"
              onClick={togglePlayPause}
              aria-label={playing ? 'Pause' : 'Play'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent text-bg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
              data-testid="transcript-seek-player-toggle"
            >
              {playing ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            {/* biome-ignore lint/a11y/useMediaCaption: live captions land via the
                separate captions surface (UX spec § TranscriptSeekPlayer) once
                the transcription pipeline (Story 2.2) emits caption track URLs */}
            <audio
              ref={audioRef}
              src={audioSrc}
              controls
              className="flex-1"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              data-testid="transcript-seek-player-audio"
            />
            {/* TODO(Story 2.2 follow-up): mount <track kind="captions" srcLang="en"
                src={captionsUrl} /> once the transcription pipeline emits a WebVTT
                URL alongside the recording. */}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'AUDIO';
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
