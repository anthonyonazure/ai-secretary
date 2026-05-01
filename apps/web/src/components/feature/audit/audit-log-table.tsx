/**
 * `AuditLogTable` — Story 12.5 viewer surface.
 *
 * Queryable, filterable, exportable audit-log table backed by Story
 * 14.5's `GET /api/v1/audit-export`. Module-tinted left-border (per
 * UX spec § Step 5 visual taxonomy) — each row gets a subtle bar in
 * the module color that matches the audit `resourceType` namespace.
 *
 * Filters:
 *   - Action (multi-select; comma-separated to the API)
 *   - Resource type (single)
 *   - Date range (since / until)
 *
 * Export:
 *   - "Download CSV" hits the same endpoint with format=csv
 *
 * a11y:
 *   - role="table" / "row" / "cell" via native semantics
 *   - aria-live="polite" on the result-count line
 */

import type { AuditExportRow } from '@aisecretary/shared';
import { Download } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useId, useState } from 'react';

const RESOURCE_TYPE_BORDER_CLASS: Record<string, string> = {
  meeting: 'border-l-accent',
  recording: 'border-l-success',
  share: 'border-l-warning',
  'inbound-share': 'border-l-warning',
  user: 'border-l-fg-muted',
  tenant: 'border-l-accent',
  notification: 'border-l-fg-muted',
  consent: 'border-l-success',
  feedback: 'border-l-fg-muted',
  invite: 'border-l-fg-muted',
  dsar: 'border-l-danger',
  'inbound-share-': 'border-l-warning',
  'action-item': 'border-l-accent',
};

interface AuditLogTableProps {
  /** Result rows. */
  items: AuditExportRow[];
  /** Total count from the server (post-filter). */
  totalCount: number;
  /** Resolved range (from the response or the form). */
  rangeLabel?: string;
  /** Filter form state controlled by the host. */
  filters: {
    action: string;
    resourceType: string;
    since: string;
    until: string;
  };
  /** Called when the user submits the filter form. */
  onApplyFilters: (filters: {
    action: string;
    resourceType: string;
    since: string;
    until: string;
  }) => void;
  /** Called when the user requests a CSV export. */
  onDownloadCsv: () => void;
  /** Inflight indicator. */
  isLoading?: boolean;
}

export function AuditLogTable({
  items,
  totalCount,
  rangeLabel,
  filters,
  onApplyFilters,
  onDownloadCsv,
  isLoading = false,
}: AuditLogTableProps) {
  const [draft, setDraft] = useState(filters);
  const formId = useId();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onApplyFilters(draft);
  };

  return (
    <section className="flex flex-col gap-4" data-testid="audit-log-table">
      <form
        id={formId}
        className="flex flex-wrap items-end gap-3"
        onSubmit={handleSubmit}
        aria-label="Filter audit log"
      >
        <FilterField label="Action(s)">
          <input
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value })}
            placeholder="meeting.created,share.created"
            className="h-9 w-72 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="audit-filter-action"
          />
        </FilterField>
        <FilterField label="Resource type">
          <input
            value={draft.resourceType}
            onChange={(e) => setDraft({ ...draft, resourceType: e.target.value })}
            placeholder="meeting"
            className="h-9 w-40 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="audit-filter-resource-type"
          />
        </FilterField>
        <FilterField label="Since">
          <input
            type="datetime-local"
            value={draft.since}
            onChange={(e) => setDraft({ ...draft, since: e.target.value })}
            className="h-9 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="audit-filter-since"
          />
        </FilterField>
        <FilterField label="Until">
          <input
            type="datetime-local"
            value={draft.until}
            onChange={(e) => setDraft({ ...draft, until: e.target.value })}
            className="h-9 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="audit-filter-until"
          />
        </FilterField>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-bg hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          data-testid="audit-filter-apply"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onDownloadCsv}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-sm text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
          data-testid="audit-download-csv"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download CSV
        </button>
      </form>

      <output aria-live="polite" className="text-sm text-fg-muted">
        {isLoading
          ? 'Loading audit log…'
          : `${totalCount} result${totalCount === 1 ? '' : 's'}${rangeLabel ? ` · ${rangeLabel}` : ''}`}
      </output>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-bg/40 text-xs uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Resource</th>
              <th className="px-3 py-2 text-left">Actor</th>
              <th className="px-3 py-2 text-left">Region</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-fg-muted">
                  No matching audit entries.
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const borderClass =
                  RESOURCE_TYPE_BORDER_CLASS[row.resourceType] ?? 'border-l-fg-muted';
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-border border-l-4 ${borderClass}`}
                    data-testid={`audit-row-${row.id}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                      {new Date(row.createdAt).toISOString().slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.action}</td>
                    <td className="px-3 py-2">
                      <span className="text-fg-muted">{row.resourceType}</span>
                      {row.resourceId ? (
                        <span className="ml-1 font-mono text-xs text-fg-muted">
                          {row.resourceId.slice(0, 8)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                      {row.actorUserId ? row.actorUserId.slice(0, 8) : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-fg-muted">{row.region}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
      <span>{label}</span>
      {children}
    </div>
  );
}
