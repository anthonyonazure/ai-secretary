/**
 * `ManagerCoachingCard` — Story 8.6 (team-lead space).
 *
 * Anchored to a transcript span ((meetingId, turnId)). The team lead
 * leaves a coaching note on a teammate's meeting; the card surfaces the
 * note next to the citation and exposes a "share back" action that
 * notifies the teammate without opening a private feedback channel
 * (notes live with the meeting, not in a side conversation).
 *
 * Surveillance-aesthetic anti-pattern (UX spec Step 5 #6) — explicitly
 * avoided:
 *   - No score / percentile / leaderboard treatment.
 *   - No red-amber-green dashboard chrome.
 *   - Coach name shown as their human name, not as a manager role-tag.
 *   - Span anchor uses the same `CitationChip` visual so the coaching
 *     note feels like a teammate's annotation, not a top-down mark-up.
 */

import type { CitationRef } from '@aisecretary/shared';
import { Send, UserCircle2 } from 'lucide-react';

export interface CoachingAnnotation {
  id: string;
  /** Free-form note text the coach left. */
  note: string;
  /** Span on the teammate's transcript. */
  citation: CitationRef;
  /** Coach's display name (NOT role label — see anti-surveillance note). */
  coachName: string;
  /** ISO 8601 timestamp the note was written. */
  createdAt: string;
  /** True once the teammate has been notified via share-back. */
  sharedBack: boolean;
}

export interface ManagerCoachingCardProps {
  annotation: CoachingAnnotation;
  /** Disable share-back button while the request is inflight. */
  isPending?: boolean;
  /** Surface the share-back action; absence renders a read-only card. */
  onShareBack?: (annotationId: string) => void;
}

const formatStamp = (citation: CitationRef): string => {
  const totalSeconds = Math.floor(citation.spanStartMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function ManagerCoachingCard({
  annotation,
  isPending = false,
  onShareBack,
}: ManagerCoachingCardProps) {
  return (
    <article
      className="rounded-md border border-border bg-surface p-4 text-fg shadow-sm"
      data-testid="manager-coaching-card"
      aria-label={`Coaching note from ${annotation.coachName}`}
    >
      <header className="flex items-center gap-2 text-sm text-fg-muted">
        <UserCircle2 className="h-4 w-4" aria-hidden="true" />
        <span className="font-medium text-fg">{annotation.coachName}</span>
        <span aria-hidden="true">·</span>
        <span>{formatDate(annotation.createdAt)}</span>
      </header>

      <p className="mt-2 text-base leading-relaxed">{annotation.note}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-xs text-fg">
          {annotation.citation.speaker ?? 'Speaker'} · {formatStamp(annotation.citation)}
        </span>
        {annotation.sharedBack ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success"
            data-testid="shared-back-indicator"
          >
            Shared back
          </span>
        ) : null}
      </div>

      {onShareBack && !annotation.sharedBack ? (
        <div className="mt-4">
          <button
            type="button"
            disabled={isPending}
            onClick={() => onShareBack(annotation.id)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-sm text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="share-back"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Share with teammate
          </button>
        </div>
      ) : null}
    </article>
  );
}
