/**
 * `/settings/audit-log` — admin audit-log viewer (Story 12.5 + 14.5).
 *
 * Wires the `AuditLogTable` component (filters, paginated rows, CSV
 * download) against the Story 14.5 `GET /api/v1/audit-export` endpoint.
 *
 * Auth gate happens server-side (org_admin only). Front-end shows the
 * full table for any authenticated admin who navigates here; non-admins
 * are bounced before reaching the route via the auth layout.
 */

import { type AuditExportResponse, auditExportResponseSchema } from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ScrollText } from 'lucide-react';
import { useCallback, useState } from 'react';

import { AuditLogTable } from '../../../components/feature/audit/audit-log-table';
import { useAuth, useAuthStore } from '../../../hooks/use-auth';
import { resolveApiBaseUrl } from '../../../lib/auth/api-client';

export const Route = createFileRoute('/_authenticated/settings/audit-log')({
  component: AuditLogRoute,
});

interface FilterState {
  action: string;
  resourceType: string;
  since: string;
  until: string;
}

const DEFAULT_FILTERS: FilterState = {
  action: '',
  resourceType: '',
  since: '',
  until: '',
};

const buildSearch = (filters: FilterState, format?: 'csv') => {
  const search = new URLSearchParams();
  if (filters.action.trim()) search.set('action', filters.action.trim());
  if (filters.resourceType.trim()) search.set('resourceType', filters.resourceType.trim());
  if (filters.since) search.set('since', new Date(filters.since).toISOString());
  if (filters.until) search.set('until', new Date(filters.until).toISOString());
  if (format) search.set('format', format);
  return search;
};

function AuditLogRoute() {
  const { user } = useAuth();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const exportQuery = useQuery({
    queryKey: ['audit-export', user?.id ?? 'anon', filters],
    enabled: !!user && !!accessToken,
    staleTime: 15_000,
    queryFn: async (): Promise<AuditExportResponse> => {
      const search = buildSearch(filters);
      const baseUrl = resolveApiBaseUrl();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch(
        `${baseUrl}/api/v1/audit-export${search.toString() ? `?${search.toString()}` : ''}`,
        { headers },
      );
      if (!res.ok) {
        throw new Error(`Audit export failed (${res.status})`);
      }
      const json = (await res.json()) as unknown;
      return auditExportResponseSchema.parse(json);
    },
  });

  const handleDownloadCsv = useCallback(() => {
    const search = buildSearch(filters, 'csv');
    const baseUrl = resolveApiBaseUrl();
    const url = `${baseUrl}/api/v1/audit-export?${search.toString()}`;
    // Browser download — open in a new tab so the response's
    // Content-Disposition header drives the file save dialog.
    if (accessToken) {
      // The CSV endpoint requires the auth header; we fetch then
      // synthesize a Blob URL so the browser still downloads it.
      void (async () => {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'audit-log.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      })();
    } else {
      window.open(url, '_blank');
    }
  }, [filters, accessToken]);

  const data = exportQuery.data;
  const rangeLabel = data
    ? `${new Date(data.range.since).toLocaleDateString()} → ${new Date(data.range.until).toLocaleDateString()}`
    : undefined;

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-fg"
        >
          <ScrollText className="h-4 w-4" />
        </span>
        <h1 className="font-sans text-2xl font-semibold">Audit log</h1>
      </header>

      <p className="text-sm text-fg-muted">
        Append-only ledger of every state-changing action in your tenant. Filter by action, resource
        type, and time window. Download as CSV for compliance evidence.
      </p>

      <AuditLogTable
        items={data?.items ?? []}
        totalCount={data?.totalCount ?? 0}
        rangeLabel={rangeLabel ?? ''}
        filters={filters}
        onApplyFilters={setFilters}
        onDownloadCsv={handleDownloadCsv}
        isLoading={exportQuery.isLoading}
      />
    </section>
  );
}
