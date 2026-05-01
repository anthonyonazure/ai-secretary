/**
 * `DsarQueue` — Story 14.x admin queue surface.
 *
 * Lists pending + completed DSAR requests for the org admin. Three
 * source kinds:
 *   1. **In-tenant** — current user filed via authenticated DSAR endpoint
 *      (Story 14.1)
 *   2. **Public portal** — verified third-party submission via
 *      `/data-rights` (Story 14.3)
 *   3. **Bulk** — admin-initiated for legal-hold disposition
 *
 * Each row exposes:
 *   - **Approve & queue** — runs the erasure cascade preview (Story 14.4),
 *     then queues the worker job (Story 14.2)
 *   - **Reject** — declines with a templated email
 *   - **Escalate to legal** — routes to a separate review queue
 *
 * The actual erasure preview opens in a modal (using
 * `ErasureCascadePreview` from Story 14.4); this component is the
 * queue + per-row action surface.
 */

import { Inbox, ScanText } from 'lucide-react';

export type DsarQueueRowStatus =
  | 'pending'
  | 'preview-ready'
  | 'queued'
  | 'completed'
  | 'rejected'
  | 'escalated';

export interface DsarQueueRow {
  id: string;
  source: 'in-tenant' | 'public-portal' | 'bulk';
  kind: 'access' | 'deletion' | 'correction';
  /** Submitter email or display name. */
  submitter: string;
  /** ISO 8601 created timestamp. */
  createdAt: string;
  /** ISO 8601 statute deadline (typically created+30d). */
  dueBy: string;
  status: DsarQueueRowStatus;
  /** Optional summary of the cascade preview if it's been computed. */
  previewSummary?: string | null;
}

export interface DsarQueueProps {
  rows: DsarQueueRow[];
  isLoading?: boolean;
  onPreview: (row: DsarQueueRow) => void;
  onApprove: (row: DsarQueueRow) => void;
  onReject: (row: DsarQueueRow) => void;
  onEscalate: (row: DsarQueueRow) => void;
}

const STATUS_BADGE: Record<DsarQueueRowStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-warning/15 text-warning' },
  'preview-ready': { label: 'Preview ready', className: 'bg-accent-soft text-accent' },
  queued: { label: 'Queued', className: 'bg-accent-soft text-accent' },
  completed: { label: 'Completed', className: 'bg-success/15 text-success' },
  rejected: { label: 'Rejected', className: 'bg-fg-muted/15 text-fg-muted' },
  escalated: { label: 'With legal', className: 'bg-fg-muted/15 text-fg-muted' },
};

const SOURCE_LABEL: Record<DsarQueueRow['source'], string> = {
  'in-tenant': 'In-tenant',
  'public-portal': 'Public portal',
  bulk: 'Bulk',
};

const formatDueBy = (iso: string): { label: string; isOverdue: boolean } => {
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return { label: iso, isOverdue: false };
  const now = Date.now();
  const remaining = due.getTime() - now;
  const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  if (days < 0) {
    return { label: `${Math.abs(days)}d overdue`, isOverdue: true };
  }
  if (days === 0) return { label: 'today', isOverdue: false };
  return { label: `in ${days}d`, isOverdue: false };
};

export function DsarQueue({
  rows,
  isLoading = false,
  onPreview,
  onApprove,
  onReject,
  onEscalate,
}: DsarQueueProps) {
  return (
    <section
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5"
      data-testid="dsar-queue"
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-fg"
        >
          <Inbox className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Data-rights queue</h2>
          <p className="text-sm text-fg-muted">
            DSAR + erasure requests across in-tenant users, public-portal submissions, and bulk
            admin actions. The 30-day statute deadline is shown on every row.
          </p>
        </div>
      </header>

      {isLoading ? (
        <output className="block py-6 text-center text-sm text-fg-muted">Loading queue…</output>
      ) : rows.length === 0 ? (
        <output
          className="block rounded-md border border-dashed border-border bg-bg p-6 text-center text-sm text-fg-muted"
          data-testid="dsar-queue-empty"
        >
          No pending requests. The public portal sits at /data-rights.
        </output>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="dsar-queue-rows">
          {rows.map((row) => {
            const badge = STATUS_BADGE[row.status];
            const due = formatDueBy(row.dueBy);
            return (
              <li
                key={row.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3 sm:flex-row sm:items-center sm:justify-between"
                data-testid={`dsar-queue-row-${row.id}`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-fg-muted">
                      {SOURCE_LABEL[row.source]}
                    </span>
                    <span className="font-medium">{row.kind}</span>
                    <span className="text-fg">·</span>
                    <span className="text-fg">{row.submitter}</span>
                  </div>
                  {row.previewSummary ? (
                    <p className="text-xs text-fg-muted">{row.previewSummary}</p>
                  ) : null}
                  <p className={`text-xs ${due.isOverdue ? 'text-danger' : 'text-fg-muted'}`}>
                    Due {due.label}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onPreview(row)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-bg px-2 text-xs text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    data-testid={`dsar-queue-preview-${row.id}`}
                  >
                    <ScanText className="h-3 w-3" aria-hidden="true" />
                    Preview
                  </button>
                  {row.status === 'pending' || row.status === 'preview-ready' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onApprove(row)}
                        className="inline-flex h-8 items-center rounded-md bg-danger px-2 text-xs font-medium text-bg hover:bg-danger/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                        data-testid={`dsar-queue-approve-${row.id}`}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(row)}
                        className="inline-flex h-8 items-center rounded-md border border-border bg-bg px-2 text-xs text-fg-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        data-testid={`dsar-queue-reject-${row.id}`}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => onEscalate(row)}
                        className="inline-flex h-8 items-center rounded-md border border-border bg-bg px-2 text-xs text-fg-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        data-testid={`dsar-queue-escalate-${row.id}`}
                      >
                        Legal
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
