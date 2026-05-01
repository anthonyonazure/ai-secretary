/**
 * `/settings/inbound-shares` — receiving-tenant admin queue.
 *
 * Wires `InboundSharesQueue` (Story 8.4 admin UI) to the inbound-share
 * read endpoint. The data fetch + mutations are stubbed today
 * (production wires `GET /api/v1/tenants/me/inbound-shares` once the
 * read route ships); the page is exercisable end-to-end via local
 * state.
 */

import { createFileRoute } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';
import { useCallback, useState } from 'react';

import {
  type InboundShareRow,
  InboundSharesQueue,
} from '../../../components/feature/admin/inbound-shares-queue';

export const Route = createFileRoute('/_authenticated/settings/inbound-shares')({
  component: InboundSharesAdminRoute,
});

const SAMPLE_ROWS: InboundShareRow[] = [
  {
    id: 'inb-1',
    sourceTenantDomain: 'partner.example',
    sourceUserEmail: 'alex@partner.example',
    recipientEmail: 'sam@acme.example',
    resourceLabel: 'Quarterly review',
    kind: 'meeting',
    status: 'pending',
    createdAt: '2026-04-29T10:00:00Z',
    expiresAt: '2026-05-29T10:00:00Z',
  },
];

function InboundSharesAdminRoute() {
  const [rows, setRows] = useState<InboundShareRow[]>(SAMPLE_ROWS);

  const handleView = useCallback((row: InboundShareRow) => {
    if (typeof window !== 'undefined') {
      window.open(`/share/${row.id}`, '_blank', 'noopener');
    }
  }, []);

  const handleBlockDomain = useCallback((domain: string) => {
    // Optimistic local-state flip; production wires the cross-org
    // policy mutation (PUT /api/v1/tenants/me/cross-org-policy).
    setRows((prev) =>
      prev.map((row) =>
        row.sourceTenantDomain === domain ? { ...row, status: 'blocked-by-policy' } : row,
      ),
    );
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
        <h1 className="font-sans text-2xl font-semibold">Inbound shares</h1>
      </header>

      <InboundSharesQueue rows={rows} onView={handleView} onBlockDomain={handleBlockDomain} />
    </section>
  );
}
