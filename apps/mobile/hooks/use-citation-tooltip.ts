/**
 * `deriveCitationTooltipState` — FR78 hover/focus tooltip state for
 * inline citation chips. The native screen wires this to a Pressable
 * with `onLongPress`; web wires it to a Radix Tooltip with delay.
 */

export type CitationTooltipInput = {
  isOpen: boolean;
  hasSnippet: boolean;
  snippet: string;
  speaker: string | null;
  spanStartMs: number;
  isReducedMotion: boolean;
  isLoading: boolean;
};

export type CitationTooltipState = {
  visible: boolean;
  body: string;
  showSpinner: boolean;
  fadeMs: number;
};

const FADE_FULL_MS = 150;
const FADE_REDUCED_MS = 0;
const SNIPPET_MAX = 220;

const formatStamp = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const deriveCitationTooltipState = (input: CitationTooltipInput): CitationTooltipState => {
  if (!input.isOpen) {
    return { visible: false, body: '', showSpinner: false, fadeMs: 0 };
  }
  const fadeMs = input.isReducedMotion ? FADE_REDUCED_MS : FADE_FULL_MS;
  if (input.isLoading) {
    return {
      visible: true,
      body: 'Loading transcript…',
      showSpinner: true,
      fadeMs,
    };
  }
  const stamp = formatStamp(input.spanStartMs);
  const speakerLine = input.speaker ?? 'Speaker';
  const snippet = input.hasSnippet
    ? input.snippet.length > SNIPPET_MAX
      ? `${input.snippet.slice(0, SNIPPET_MAX - 1).trimEnd()}…`
      : input.snippet
    : '(no preview available)';
  return {
    visible: true,
    body: `${speakerLine} · ${stamp}\n${snippet}`,
    showSpinner: false,
    fadeMs,
  };
};
