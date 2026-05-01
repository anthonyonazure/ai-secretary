import { MessageSquareQuote } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import type { CitationRef } from '@aisecretary/shared';

import { findFixtureTurn } from './speaker-turns.fixture';
import { TranscriptSeekPlayer } from './transcript-seek-player';

/**
 * `CitationChip` — V2 iconic glyph (Story 3.5).
 *
 * Replaces the Story 3.4 placeholder. Anatomy per UX spec § "CitationChip
 * — V2 iconic glyph":
 *
 *   pill container (bg-accent-soft) · speaker glyph · mono timestamp ·
 *   hover preview tooltip · click → opens `TranscriptSeekPlayer` and
 *   plays a 5s pre-roll (`spanStartMs - 5000`, clamped at 0).
 *
 * Glyph note: shipping with the lucide `MessageSquareQuote` icon as the
 * "interim glyph". The locked UX spec calls for a custom speaker-quote
 * illustration; the designer-brief follow-up
 * (`_bmad-output/planning-artifacts/open-work/`) covers the bespoke
 * illustration handoff. This file is the single swap point.
 *
 * Backwards-compat: the prop signature consumed by `analysis-card.tsx`
 * (`citation: CitationRef`, `onClick?: (citation) => void`) is preserved.
 * When `onClick` is omitted, the chip opens its internal
 * `TranscriptSeekPlayer` Dialog. When `onClick` is supplied, the host
 * controls the seek surface (used by the email variant + future RAG
 * chat to suppress the player modal).
 *
 * A11y:
 *   - `role="button"` with `aria-label="Citation at MM:SS, speaker {name}"`
 *   - Keyboard: Enter / Space activate
 *   - `aria-describedby` linked to the tooltip preview content when
 *     visible (focus or hover); hidden when neither is true
 *   - Touch-target floor of 44×44px enforced by an outer wrapper span;
 *     the visible chip can be smaller (~24px) per UX spec
 *
 * Visited state persists per `(meetingId, turnId)` in `sessionStorage`
 * for the duration of the current tab session (cleared on tab close —
 * deliberately session-scoped so visit highlighting doesn't carry over
 * into a new working session).
 */

export type CitationChipVariant = 'inline' | 'block' | 'compact';

export interface CitationChipProps {
  citation: CitationRef;
  onClick?: (citation: CitationRef) => void;
  variant?: CitationChipVariant;
  /**
   * Meeting title surfaced in the `TranscriptSeekPlayer` header. Optional
   * — falls back to "Transcript" when not provided. Hosts that already
   * know the title (e.g. ReceiptStreamLayout) should pass it through.
   */
  meetingTitle?: string;
}

const VISITED_KEY_PREFIX = 'citation-chip:visited:';

export function CitationChip({
  citation,
  onClick,
  variant = 'inline',
  meetingTitle,
}: CitationChipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(false);
  const [visited, setVisited] = useState(false);

  const fixtureTurn = useMemo(() => findFixtureTurn(citation), [citation]);
  const previewText = fixtureTurn?.text;
  const speakerLabel = citation.speaker ?? fixtureTurn?.speaker ?? null;

  // Citation source missing → render the disabled state (UX spec).
  const disabled = !fixtureTurn && !previewText;

  // Restore visited state from sessionStorage on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const key = `${VISITED_KEY_PREFIX}${citation.meetingId}:${citation.turnId}`;
      if (window.sessionStorage.getItem(key) === '1') {
        setVisited(true);
      }
    } catch {
      // sessionStorage may throw in privacy-mode iframes; visited just stays false.
    }
  }, [citation.meetingId, citation.turnId]);

  const markVisited = useCallback(() => {
    setVisited(true);
    if (typeof window === 'undefined') return;
    try {
      const key = `${VISITED_KEY_PREFIX}${citation.meetingId}:${citation.turnId}`;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // ignore
    }
  }, [citation.meetingId, citation.turnId]);

  const flashActive = useCallback(() => {
    setActive(true);
    // 120ms flash matching --motion-fast token.
    window.setTimeout(() => setActive(false), 120);
  }, []);

  const handleActivate = useCallback(() => {
    if (disabled) return;
    flashActive();
    markVisited();
    if (onClick) {
      onClick(citation);
    } else {
      setOpen(true);
    }
  }, [citation, disabled, flashActive, markVisited, onClick]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate();
    }
  };

  const ariaLabel = disabled
    ? 'Citation unavailable'
    : `Citation at ${formatTimestamp(citation.spanStartMs)}${speakerLabel ? `, speaker ${speakerLabel}` : ''}`;

  const showTooltip = (hovered || focused) && !disabled && Boolean(previewText);

  return (
    <span
      // Touch-target floor — the visible chip can be smaller; the
      // wrapping span captures the AAA-grade 44×44px hit area.
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center align-baseline"
    >
      <button
        type="button"
        onClick={handleActivate}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={showTooltip ? tooltipId : undefined}
        aria-haspopup={onClick ? undefined : 'dialog'}
        data-citation-meeting-id={citation.meetingId}
        data-citation-turn-id={citation.turnId}
        data-variant={variant}
        data-state={disabled ? 'disabled' : active ? 'active' : visited ? 'visited' : 'default'}
        className={chipClasses({ variant, disabled, active, visited })}
      >
        <MessageSquareQuote
          className={glyphSize(variant)}
          aria-hidden="true"
          data-glyph="speaker-quote-interim"
        />
        <span className="font-mono tabular-nums">{formatTimestamp(citation.spanStartMs)}</span>
      </button>

      {showTooltip ? (
        <span
          role="tooltip"
          id={tooltipId}
          className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 w-max max-w-xs -translate-x-1/2 rounded-md border border-border bg-surface p-2 text-xs text-fg shadow-md motion-reduced:transition-none"
        >
          {speakerLabel ? (
            <span className="block font-semibold text-fg">{speakerLabel}</span>
          ) : null}
          <span className="block text-fg-muted">{previewText}</span>
        </span>
      ) : null}

      {/* Internal player surface — only mounted when the dialog is
          actually open (host did not pass onClick). Lazy-mounting keeps
          the React Query subscription dormant until needed, so chips
          embedded in story contexts without a QueryClientProvider
          don't crash during preview rendering. */}
      {!onClick && open ? (
        <TranscriptSeekPlayer
          open={open}
          onOpenChange={setOpen}
          citation={citation}
          {...(meetingTitle !== undefined ? { meetingTitle } : {})}
        />
      ) : null}
    </span>
  );
}

function chipClasses({
  variant,
  disabled,
  active,
  visited,
}: {
  variant: CitationChipVariant;
  disabled: boolean;
  active: boolean;
  visited: boolean;
}): string {
  const sizing =
    variant === 'compact'
      ? 'h-5 gap-0.5 px-1 text-[11px]'
      : variant === 'block'
        ? 'h-7 gap-1.5 px-2 text-sm'
        : 'h-6 gap-1 px-1.5 text-xs';

  const base = `inline-flex items-center rounded-sm align-baseline ${sizing}`;

  if (disabled) {
    return `${base} cursor-not-allowed bg-fg/5 text-fg-muted/50 border border-dashed border-border`;
  }

  const fill = active
    ? 'bg-accent text-bg'
    : visited
      ? 'bg-accent-soft text-fg-muted border border-accent/40'
      : 'bg-accent-soft text-fg-muted hover:text-fg';

  const focus =
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg';

  // Active flash uses --motion-fast (120ms).
  const transition = 'transition-colors duration-[120ms] motion-reduced:transition-none';

  return `${base} ${fill} ${focus} ${transition}`;
}

function glyphSize(variant: CitationChipVariant): string {
  if (variant === 'compact') return 'h-2.5 w-2.5';
  if (variant === 'block') return 'h-4 w-4';
  return 'h-3 w-3';
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
