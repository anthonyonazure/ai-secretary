/**
 * `ErasureCascadePreview` — Story 14.4 admin UI.
 *
 * Renders the cascade-scope preview returned by the Story 14.4
 * `/api/v1/erasure-preview/:userId` endpoint. The org admin sees
 * a per-table breakdown of what the destructive erasure would touch,
 * along with three CTAs:
 *   - **Approve** — confirms the erasure and queues the worker job
 *   - **Reject** — declines the request (sends a templated email back)
 *   - **Escalate to legal** — sends the request to the legal-review
 *     queue (a separate sub-team)
 *
 * Anti-surveillance discipline: no leaderboard / scoreboard chrome.
 * The preview is a clinical, plain-language summary the admin reviews
 * before signing off.
 */

import type { ErasurePreviewResponse, ErasurePreviewStage } from '@aisecretary/shared';
import { AlertTriangle, ScanText, ShieldAlert } from 'lucide-react';

const ACTION_BADGE_CLASS: Record<ErasurePreviewStage['action'], string> = {
  shred: 'bg-danger/15 text-danger',
  redact: 'bg-warning/15 text-warning',
  'soft-delete': 'bg-warning/15 text-warning',
  'cascade-fk': 'bg-fg-muted/15 text-fg-muted',
  'cascade-source-skipped': 'bg-fg-muted/10 text-fg-muted',
  'noop-out-of-scope': 'bg-fg-muted/10 text-fg-muted',
};

const ACTION_LABEL: Record<ErasurePreviewStage['action'], string> = {
  shred: 'Hard delete',
  redact: 'Redact PII',
  'soft-delete': 'Soft delete',
  'cascade-fk': 'Auto cascade',
  'cascade-source-skipped': 'Skipped (tenant-only)',
  'noop-out-of-scope': 'Untouched',
};

export interface ErasureCascadePreviewProps {
  preview: ErasurePreviewResponse;
  isPending?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEscalate: () => void;
}

export function ErasureCascadePreview({
  preview,
  isPending = false,
  onApprove,
  onReject,
  onEscalate,
}: ErasureCascadePreviewProps) {
  const visibleStages = preview.stages.filter(
    (s) => s.action !== 'noop-out-of-scope' && s.action !== 'cascade-source-skipped',
  );
  const hiddenStages = preview.stages.filter(
    (s) => s.action === 'noop-out-of-scope' || s.action === 'cascade-source-skipped',
  );

  return (
    <section
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5"
      data-testid="erasure-cascade-preview"
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-danger/10 text-danger"
        >
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Erasure scope preview</h2>
          <p className="text-sm text-fg-muted">
            This is what the worker would touch if you approved the request right now. No data has
            been deleted.
          </p>
        </div>
      </header>

      <output
        aria-live="polite"
        className="block rounded-md bg-bg/60 p-3 text-sm"
        data-testid="erasure-preview-summary"
      >
        <span className="font-semibold">{preview.totalRowsAffected.toLocaleString()}</span>
        <span className="ml-1 text-fg-muted">
          row{preview.totalRowsAffected === 1 ? '' : 's'} would be touched across{' '}
          {visibleStages.length} table{visibleStages.length === 1 ? '' : 's'}
        </span>
      </output>

      <ul className="flex flex-col gap-2" data-testid="erasure-preview-stages">
        {visibleStages.map((stage) => (
          <li
            key={stage.table}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-bg p-3 text-sm"
            data-testid={`erasure-stage-${stage.table}`}
          >
            <div className="flex items-center gap-3">
              <ScanText className="h-4 w-4 text-fg-muted" aria-hidden="true" />
              <div>
                <p className="font-mono text-xs font-medium">{stage.table}</p>
                {stage.note ? <p className="text-xs text-fg-muted">{stage.note}</p> : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_BADGE_CLASS[stage.action]}`}
              >
                {ACTION_LABEL[stage.action]}
              </span>
              <span className="font-mono text-sm font-semibold">{stage.rowCount}</span>
            </div>
          </li>
        ))}
      </ul>

      {hiddenStages.length > 0 ? (
        <details className="rounded-md border border-border bg-bg p-3 text-sm">
          <summary className="cursor-pointer text-fg-muted">
            {hiddenStages.length} table{hiddenStages.length === 1 ? '' : 's'} intentionally
            untouched
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-fg-muted">
            {hiddenStages.map((s) => (
              <li key={s.table}>
                <span className="font-mono">{s.table}</span>
                {s.note ? <span className="ml-2">— {s.note}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {!preview.fullyHandled ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-warning bg-warning/10 p-3 text-sm text-warning"
          data-testid="erasure-not-fully-handled"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Some tables in the cascade map don't yet have a counter — the preview may understate the
            row count. Escalate to engineering before approving.
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={onApprove}
          className="inline-flex h-9 items-center rounded-md bg-danger px-3 text-sm font-medium text-bg hover:bg-danger/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="erasure-approve"
        >
          {isPending ? 'Queuing…' : 'Approve & queue erasure'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={onReject}
          className="inline-flex h-9 items-center rounded-md border border-border bg-bg px-3 text-sm text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="erasure-reject"
        >
          Reject request
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={onEscalate}
          className="inline-flex h-9 items-center rounded-md border border-border bg-bg px-3 text-sm text-fg-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="erasure-escalate"
        >
          Escalate to legal
        </button>
      </div>
    </section>
  );
}
