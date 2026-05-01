/**
 * `FirstReceiptPolish` — Story 1.7.
 *
 * Wraps the first three meeting receipts with extra polish. Per UX
 * spec § F2 user first-launch flow:
 *
 *   - Receipts 1–3 → celebration animation on first mount + thumbs
 *     prompt below the analysis card.
 *   - Receipt 4+ → calm default (no animation, no thumbs prompt).
 *
 * Reduced-motion fallback: when the OS-level
 * `prefers-reduced-motion: reduce` media query matches, we drop the
 * scale-in fade and render a subtle highlight ring only — same surface
 * area, no movement.
 *
 * The polish hook is always rendered; the component itself decides
 * whether to apply animation. This keeps the route surface stable and
 * the test surface easy to assert against.
 */

import { useEffect, useState } from 'react';
import { useFirstLaunchStore, useIsFirstThreeReceipts } from '../../../hooks/first-launch-store';
import { ThumbsPrompt } from './thumbs-prompt';

export interface FirstReceiptPolishProps {
  meetingId: string;
  children: React.ReactNode;
  /** Optional override for tests — defaults to OS pref. */
  reducedMotion?: boolean;
}

const detectReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export function FirstReceiptPolish({
  meetingId,
  children,
  reducedMotion,
}: FirstReceiptPolishProps) {
  const markReceiptViewed = useFirstLaunchStore((s) => s.markReceiptViewed);
  const isFirstThree = useIsFirstThreeReceipts();
  const [mounted, setMounted] = useState(false);

  // One-shot: bump the receipts-viewed counter the first time this
  // meeting receipt mounts. The store's internal dedupe ensures the
  // count stays accurate when the user revisits a meeting they've
  // already opened.
  useEffect(() => {
    markReceiptViewed(meetingId);
  }, [meetingId, markReceiptViewed]);

  // Drive the celebration animation on first paint. We delay the
  // class-application by one frame so the transition fires; without
  // the delay the element is in its final state on first commit.
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 16);
    return () => clearTimeout(t);
  }, []);

  if (!isFirstThree) {
    return (
      <div data-testid="first-receipt-polish-calm" data-polish="calm">
        {children}
      </div>
    );
  }

  const reduced = reducedMotion ?? detectReducedMotion();
  const wrapperClass = reduced
    ? 'rounded-md ring-2 ring-accent ring-offset-2 ring-offset-bg'
    : `transition-all duration-500 ease-out ${
        mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-[0.98]'
      }`;

  return (
    <div
      data-testid="first-receipt-polish"
      data-polish="celebrate"
      data-reduced-motion={reduced ? 'true' : 'false'}
      className="flex flex-col gap-4"
    >
      <div className={wrapperClass}>{children}</div>
      <ThumbsPrompt meetingId={meetingId} context="first-three" />
    </div>
  );
}
