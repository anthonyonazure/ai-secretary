import { useEffect, useState } from 'react';

/**
 * Drives the visible timer (1s tick) and the announced timer (30s tick) for
 * `RecordingStatusPill` on every platform. Splitting the two cadences keeps
 * the visual MM:SS lively while honoring the UX spec rule that screen-reader
 * announcements arrive at most every 30 seconds — both `aria-live="polite"`
 * (web) and `accessibilityLiveRegion="polite"` (RN) re-announce on label
 * change, so throttling avoids spam.
 *
 * React-only; no DOM- or RN-specific primitives — safe to import from either
 * `apps/web` or `apps/mobile`.
 */
export interface RecordingTimer {
  /** "MM:SS" string. Pads minutes to 2 digits up to 99; overflows to MMM:SS at 100+. */
  display: string;
  /** Whole seconds rounded to the nearest 30s boundary; drives the ARIA label. */
  ariaSeconds: number;
}

export function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  const minutesPart = mm < 100 ? String(mm).padStart(2, '0') : String(mm);
  return `${minutesPart}:${String(ss).padStart(2, '0')}`;
}

export function useRecordingTimer(elapsedSeconds: number, isActive: boolean): RecordingTimer {
  const [now, setNow] = useState(() => elapsedSeconds);
  const [ariaSeconds, setAriaSeconds] = useState(() => roundToNearest30s(elapsedSeconds));

  useEffect(() => {
    setNow(elapsedSeconds);
    setAriaSeconds(roundToNearest30s(elapsedSeconds));
  }, [elapsedSeconds]);

  useEffect(() => {
    if (!isActive) return;
    const visualHandle = setInterval(() => {
      setNow((prev) => prev + 1);
    }, 1000);
    const ariaHandle = setInterval(() => {
      setAriaSeconds((prev) => prev + 30);
    }, 30000);
    return () => {
      clearInterval(visualHandle);
      clearInterval(ariaHandle);
    };
  }, [isActive]);

  return {
    display: formatTimer(now),
    ariaSeconds,
  };
}

function roundToNearest30s(seconds: number): number {
  return Math.floor(Math.max(0, seconds) / 30) * 30;
}

export function describeAriaSeconds(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  const minutePart = mm === 0 ? '' : `${mm} minute${mm === 1 ? '' : 's'}`;
  const secondPart = ss === 0 ? '' : `${ss} second${ss === 1 ? '' : 's'}`;
  if (!minutePart && !secondPart) return '0 seconds';
  return [minutePart, secondPart].filter(Boolean).join(' ');
}
