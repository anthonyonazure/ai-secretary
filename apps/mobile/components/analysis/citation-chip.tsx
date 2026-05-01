import type { CitationRef } from '@aisecretary/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { findFixtureTurn } from './speaker-turns.fixture';
import { TranscriptSeekPlayer } from './transcript-seek-player';

/**
 * Mobile `CitationChip` — RN counterpart of the web V2 iconic-glyph
 * chip. Anatomy: pill container · speaker glyph (Text "❝" — interim
 * until the designer brief lands the bespoke illustration; matches the
 * web chip's `MessageSquareQuote` placeholder commitment) · mono
 * timestamp · long-press preview · short-tap → opens
 * `TranscriptSeekPlayer` and plays a 5s pre-roll.
 *
 * State table (mirrors web): default / pressed / focus / disabled /
 * visited. Visited persists in-memory for the app lifecycle keyed by
 * `(meetingId, turnId)`. The fixture short-circuit lives in the same
 * place as the web chip — see `speaker-turns.fixture.ts`.
 *
 * A11y:
 *   - `accessibilityRole="button"` + `accessibilityLabel="Citation at MM:SS, speaker {name}"`
 *   - Touch target ≥44pt via Pressable hitSlop + min-h-11
 *   - Long-press surfaces preview text (RN equivalent of hover); the
 *     same content is read by VoiceOver / TalkBack on focus.
 *
 * Backwards-compat: `(citation, onClick?)` matches the web prop
 * signature so call sites that share types via `@aisecretary/shared`
 * can pass-through without conditionals.
 */

export type CitationChipVariant = 'inline' | 'block' | 'compact';

export interface CitationChipProps {
  citation: CitationRef;
  onClick?: (citation: CitationRef) => void;
  variant?: CitationChipVariant;
  meetingTitle?: string;
}

// Module-scoped visited cache. Persists for the app session; cleared on
// app cold-start. Same scoping intent as the web `sessionStorage` key.
const visitedCache = new Set<string>();

function visitedKey(citation: CitationRef): string {
  return `${citation.meetingId}:${citation.turnId}`;
}

export function CitationChip({
  citation,
  onClick,
  variant = 'inline',
  meetingTitle,
}: CitationChipProps) {
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [visited, setVisited] = useState(() => visitedCache.has(visitedKey(citation)));

  const fixtureTurn = useMemo(() => findFixtureTurn(citation), [citation]);
  const previewText = fixtureTurn?.text;
  const speakerLabel = citation.speaker ?? fixtureTurn?.speaker ?? null;
  const disabled = !fixtureTurn && !previewText;

  useEffect(() => {
    setVisited(visitedCache.has(visitedKey(citation)));
  }, [citation]);

  const markVisited = useCallback(() => {
    visitedCache.add(visitedKey(citation));
    setVisited(true);
  }, [citation]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    markVisited();
    if (onClick) {
      onClick(citation);
    } else {
      setOpen(true);
    }
  }, [citation, disabled, markVisited, onClick]);

  const accessibilityLabel = disabled
    ? 'Citation unavailable'
    : `Citation at ${formatTimestamp(citation.spanStartMs)}${speakerLabel ? `, speaker ${speakerLabel}` : ''}`;

  return (
    <View className="relative self-start">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, selected: visited }}
        disabled={disabled}
        onPress={handlePress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onLongPress={() => {
          if (!disabled && previewText) setPreviewVisible(true);
        }}
        delayLongPress={400}
        hitSlop={10}
        testID={`citation-chip:${citation.meetingId}:${citation.turnId}`}
        className={chipClasses({ variant, disabled, pressed, visited })}
      >
        <Text accessibilityElementsHidden className={glyphClass(variant)}>
          {'❝'}
        </Text>
        <Text
          className={`${textClass(variant)} ${disabled ? 'text-fg-muted/50' : 'text-fg-muted'}`}
        >
          {formatTimestamp(citation.spanStartMs)}
        </Text>
      </Pressable>

      {previewVisible && previewText ? (
        <Pressable
          onPress={() => setPreviewVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss preview"
          testID="citation-chip-preview"
          className="absolute left-0 top-full z-30 mt-1 max-w-xs rounded-md border border-border bg-surface p-2 shadow-md"
        >
          {speakerLabel ? (
            <Text className="text-xs font-semibold text-fg">{speakerLabel}</Text>
          ) : null}
          <Text className="text-xs text-fg-muted">{previewText}</Text>
        </Pressable>
      ) : null}

      {!onClick && open ? (
        <TranscriptSeekPlayer
          open={open}
          onOpenChange={setOpen}
          citation={citation}
          {...(meetingTitle !== undefined ? { meetingTitle } : {})}
        />
      ) : null}
    </View>
  );
}

function chipClasses({
  variant,
  disabled,
  pressed,
  visited,
}: {
  variant: CitationChipVariant;
  disabled: boolean;
  pressed: boolean;
  visited: boolean;
}): string {
  const sizing =
    variant === 'compact'
      ? 'min-h-11 px-1 py-0.5'
      : variant === 'block'
        ? 'min-h-11 px-2 py-1.5'
        : 'min-h-11 px-1.5 py-1';

  const base = `flex-row items-center gap-1 rounded-sm ${sizing}`;

  if (disabled) {
    return `${base} bg-fg/5 border border-dashed border-border opacity-60`;
  }
  if (pressed) {
    return `${base} bg-accent`;
  }
  if (visited) {
    return `${base} bg-accent-soft border border-accent/40`;
  }
  return `${base} bg-accent-soft`;
}

function glyphClass(variant: CitationChipVariant): string {
  if (variant === 'compact') return 'text-[11px] text-fg-muted';
  if (variant === 'block') return 'text-base text-fg-muted';
  return 'text-xs text-fg-muted';
}

function textClass(variant: CitationChipVariant): string {
  if (variant === 'compact') return 'font-mono text-[11px]';
  if (variant === 'block') return 'font-mono text-sm';
  return 'font-mono text-xs';
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
