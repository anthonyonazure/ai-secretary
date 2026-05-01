/**
 * Action-item card — Story 8.5 (My Actions page).
 *
 * One row per action item. Displays the commitment text, the source-
 * meeting backlink, the owner name + due date, and a one-tap mark-done
 * button. The deep-link points at the source meeting's receipt
 * (`/meetings/:id`) so users can jump back to the conversation that
 * surfaced the commitment.
 *
 * Status FSM (UI-visible):
 *   pending → done            (mark-done)
 *   accepted → done           (mark-done)
 *   pending|accepted → dismissed (dismiss button)
 *   done|dismissed → no actions
 */

import type { ActionItemRow, ActionItemStatus } from '@aisecretary/shared';
import { Link } from '@tanstack/react-router';
import { Calendar, Check, X } from 'lucide-react';

interface ActionItemCardProps {
  item: ActionItemRow;
  /** Inflight ids — disables the buttons while a mutation is pending. */
  isPending: boolean;
  onUpdateStatus: (id: string, status: ActionItemStatus) => void;
}

const formatDueDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const statusBadgeClass: Record<ActionItemStatus, string> = {
  pending: 'bg-warning/15 text-warning',
  accepted: 'bg-accent-soft text-accent',
  done: 'bg-success/15 text-success',
  dismissed: 'bg-fg-muted/15 text-fg-muted',
};

export function ActionItemCard({ item, isPending, onUpdateStatus }: ActionItemCardProps) {
  const due = formatDueDate(item.dueDate);
  const isClosed = item.status === 'done' || item.status === 'dismissed';

  return (
    <li
      className="rounded-md border border-border bg-surface p-4 text-fg shadow-sm"
      data-testid="action-item-card"
      data-status={item.status}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="flex-1 text-base font-medium leading-snug">{item.text}</p>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[item.status]}`}
        >
          {item.status}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-fg-muted sm:grid-cols-3">
        {item.ownerName ? (
          <div>
            <dt className="sr-only">Owner</dt>
            <dd>
              <span className="font-medium text-fg">{item.ownerName}</span>
            </dd>
          </div>
        ) : null}
        {due ? (
          <div className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <dt className="sr-only">Due</dt>
            <dd>{due}</dd>
          </div>
        ) : null}
        <div className="sm:text-right">
          <dt className="sr-only">Source meeting</dt>
          <dd>
            <Link
              to="/meetings/$meetingId"
              params={{ meetingId: item.meetingId }}
              className="text-accent underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            >
              {item.meetingTitle}
            </Link>
          </dd>
        </div>
      </dl>

      {!isClosed ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => onUpdateStatus(item.id, 'done')}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-bg hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="mark-done"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Mark done
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onUpdateStatus(item.id, 'dismissed')}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-sm text-fg-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="dismiss"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Dismiss
          </button>
        </div>
      ) : null}
    </li>
  );
}
