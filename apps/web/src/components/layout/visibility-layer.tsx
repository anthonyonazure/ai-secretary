/**
 * Single-user visibility layer — Story 1.6.
 *
 * `AppShell.Cards` is the canonical single-user shell (UX spec table at
 * § Navigation patterns). When the active shell is `cards`, team-lead
 * / admin / embed / CRM surfaces are hidden by default. The "Show
 * organization features" toggle in the cards header flips the shell
 * mode back to `inbox` (see `app-shell-cards.tsx`).
 *
 * `<HideInSingleUser>` is a thin presentational wrapper consumers can
 * use to hide org-only surfaces without each surface having to know
 * about the shell store. This is the discipline knob that makes the
 * single-user experience calmer without diverging code paths.
 *
 * TODO(future Story): some org-only surfaces (e.g. CRM push) live
 * outside the layout tree (hub apps, embeds). For those surfaces, gate
 * visibility at the route level via `beforeLoad` — this component
 * handles in-shell content only.
 */

import type { ReactNode } from 'react';
import { useShellMode } from './shell-mode-store';

export interface HideInSingleUserProps {
  children: ReactNode;
  /**
   * Optional override fallback for surfaces that need a placeholder
   * when hidden (instead of rendering nothing). Defaults to `null`.
   */
  fallback?: ReactNode;
}

/**
 * Hides children when the active shell is `cards` (single-user mode).
 * Renders children unconditionally when the shell is `inbox`.
 */
export function HideInSingleUser({ children, fallback = null }: HideInSingleUserProps) {
  const mode = useShellMode();
  if (mode === 'cards') return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Inverse of `HideInSingleUser` — render children only when the shell
 * is `cards`. Useful for the "Show organization features" toggle in
 * the cards header.
 */
export function OnlyInSingleUser({ children, fallback = null }: HideInSingleUserProps) {
  const mode = useShellMode();
  if (mode === 'cards') return <>{children}</>;
  return <>{fallback}</>;
}
