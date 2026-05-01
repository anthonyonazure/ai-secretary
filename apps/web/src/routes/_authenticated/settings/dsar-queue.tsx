/**
 * `/settings/dsar-queue` — admin DSAR queue + erasure preview surface.
 *
 * Wires three Story 14.x components into one queryable / approvable
 * page:
 *   - `DsarQueue` (Story 14.x) — list of pending requests
 *   - `ErasureCascadePreview` (Story 14.4) — per-row preview modal
 *   - Approve / Reject / Escalate actions (stubbed today; production
 *     wires Story 14.2 worker enqueue + email dispatch)
 */

import { type ErasurePreviewResponse, erasurePreviewResponseSchema } from '@aisecretary/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Inbox, X } from 'lucide-react';
import { useCallback, useState } from 'react';

import { DsarQueue, type DsarQueueRow } from '../../../components/feature/admin/dsar-queue';
import { ErasureCascadePreview } from '../../../components/feature/admin/erasure-cascade-preview';
import { useAuthStore } from '../../../hooks/use-auth';
import { resolveApiBaseUrl } from '../../../lib/auth/api-client';

export const Route = createFileRoute('/_authenticated/settings/dsar-queue')({
  component: DsarQueueRoute,
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const SAMPLE_ROWS: DsarQueueRow[] = [
  {
    id: 'r1',
    source: 'public-portal',
    kind: 'deletion',
    submitter: 'subject@example.com',
    createdAt: '2026-04-15T10:00:00Z',
    dueBy: new Date(Date.now() + 18 * ONE_DAY_MS).toISOString(),
    status: 'pending',
  },
  {
    id: 'r2',
    source: 'in-tenant',
    kind: 'access',
    submitter: 'casey@acme.example',
    createdAt: '2026-04-25T15:00:00Z',
    dueBy: new Date(Date.now() + 25 * ONE_DAY_MS).toISOString(),
    status: 'preview-ready',
  },
];

function DsarQueueRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<DsarQueueRow[]>(SAMPLE_ROWS);
  const [previewing, setPreviewing] = useState<DsarQueueRow | null>(null);

  const previewQuery = useQuery({
    queryKey: ['erasure-preview', previewing?.id ?? 'idle'],
    enabled: !!previewing && !!accessToken,
    staleTime: 30_000,
    queryFn: async (): Promise<ErasurePreviewResponse> => {
      if (!previewing) throw new Error('no row selected');
      const baseUrl = resolveApiBaseUrl();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      // The preview endpoint takes a userId; the queue rows here use
      // the submission id, so production wires a join. For the
      // sample rows we re-use the row id as the userId so the demo
      // route is exercisable end-to-end.
      const res = await fetch(`${baseUrl}/api/v1/erasure-preview/${previewing.id}`, {
        headers,
      });
      if (!res.ok) throw new Error(`preview failed (${res.status})`);
      const json = (await res.json()) as unknown;
      return erasurePreviewResponseSchema.parse(json);
    },
  });

  const handleApprove = useCallback((row: DsarQueueRow) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: 'queued' } : r)));
    setPreviewing(null);
  }, []);

  const handleReject = useCallback((row: DsarQueueRow) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: 'rejected' } : r)));
  }, []);

  const handleEscalate = useCallback((row: DsarQueueRow) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: 'escalated' } : r)));
  }, []);

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-fg"
        >
          <Inbox className="h-4 w-4" />
        </span>
        <h1 className="font-sans text-2xl font-semibold">DSAR queue</h1>
      </header>

      <DsarQueue
        rows={rows}
        onPreview={setPreviewing}
        onApprove={handleApprove}
        onReject={handleReject}
        onEscalate={handleEscalate}
      />

      {previewing ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-bg/80 pt-[10vh]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPreviewing(null);
          }}
        >
          {/* biome-ignore lint/a11y/useSemanticElements: native <dialog> element fights TanStack Router's focus management; the role="dialog" + aria-modal pattern is the canonical alternative. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Erasure cascade preview"
            className="w-full max-w-2xl"
          >
            <button
              type="button"
              onClick={() => setPreviewing(null)}
              aria-label="Close preview"
              className="float-right inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface text-fg-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              data-testid="dsar-preview-close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            {previewQuery.isLoading ? (
              <output className="block rounded-md border border-border bg-surface p-6 text-center text-sm text-fg-muted">
                Loading preview…
              </output>
            ) : previewQuery.isError || !previewQuery.data ? (
              <p
                role="alert"
                className="rounded-md border border-danger bg-surface p-6 text-sm text-danger"
              >
                Couldn't load the preview. Try again.
              </p>
            ) : (
              <ErasureCascadePreview
                preview={previewQuery.data}
                onApprove={() => handleApprove(previewing)}
                onReject={() => {
                  handleReject(previewing);
                  setPreviewing(null);
                }}
                onEscalate={() => {
                  handleEscalate(previewing);
                  setPreviewing(null);
                }}
              />
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
