/**
 * `InboundSharesQueue` — Story 8.4 admin UI surface.
 *
 * Lists the receiving-tenant's `inbound_shares` rows so the org admin
 * can see incoming cross-org shares + their per-share status:
 *   - 'pending'           — awaiting recipient view
 *   - 'accepted'          — recipient has viewed the share at least once
 *   - 'blocked-by-policy' — receiving-tenant policy blocked the share
 *   - 'expired'           — past the sender-side TTL
 *   - 'revoked'           — sender revoked
 *
 * Admin actions:
 *   - **View** — open the share's view (token URL or recipient view)
 *   - **Block sender domain** — adds the source tenant domain to the
 *     receiving tenant's cross-org policy whitelist exclusion (Story
 *     12.7 flips it to `block-all` for that domain via a follow-up
 *     filter; today the action just calls onBlockDomain)
 */

import { CheckCircle2, ExternalLink, ShieldAlert, ShieldX } from 'lucide-react';
import type { ReactNode } from 'react';

export type InboundShareStatus =
  | 'pending'
  | 'accepted'
  | 'blocked-by-policy'
  | 'expired'
  | 'revoked';

export interface InboundShareRow {
  id: string;
  sourceTenantDomain: string;
  sourceUserEmail: string;
  recipientEmail: string;
  resourceLabel: string;
  kind: 'meeting' | 'clip' | 'insight' | 'token-url';
  status: InboundShareStatus;
  createdAt: string;
  expiresAt: string | null;
}

export interface InboundSharesQueueProps {
  rows: InboundShareRow[];
  isLoading?: boolean;
  onView: (row: InboundShareRow) => void;
  onBlockDomain: (domain: string) => void;
}

const STATUS_BADGE: Record<
  InboundShareStatus,
  { label: string; className: string; icon: ReactNode }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-warning/15 text-warning',
    icon: null,
  },
  accepted: {
    label: 'Viewed',
    className: 'bg-success/15 text-success',
    icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
  },
  'blocked-by-policy': {
    label: 'Blocked by policy',
    className: 'bg-danger/15 text-danger',
    icon: <ShieldAlert className="h-3 w-3" aria-hidden="true" />,
  },
  expired: {
    label: 'Expired',
    className: 'bg-fg-muted/15 text-fg-muted',
    icon: null,
  },
  revoked: {
    label: 'Revoked',
    className: 'bg-fg-muted/15 text-fg-muted',
    icon: null,
  },
};

export function InboundSharesQueue({
  rows,
  isLoading = false,
  onView,
  onBlockDomain,
}: InboundSharesQueueProps) {
  return (
    <section
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5"
      data-testid="inbound-shares-queue"
    >
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Inbound shares</h2>
          <p className="text-sm text-fg-muted">
            Cross-org shares from other organizations to people in your tenant.
          </p>
        </div>
      </header>

      {isLoading ? (
        <output className="block py-6 text-center text-sm text-fg-muted">
          Loading inbound shares…
        </output>
      ) : rows.length === 0 ? (
        <output
          className="block rounded-md border border-dashed border-border bg-bg p-6 text-center text-sm text-fg-muted"
          data-testid="inbound-shares-empty"
        >
          No inbound shares yet.
        </output>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="inbound-shares-rows">
          {rows.map((row) => {
            const badge = STATUS_BADGE[row.status];
            return (
              <li
                key={row.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3 sm:flex-row sm:items-center sm:justify-between"
                data-testid={`inbound-share-${row.id}`}
              >
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{row.resourceLabel}</p>
                  <p className="text-xs text-fg-muted">
                    From <span className="font-mono">{row.sourceUserEmail}</span> at{' '}
                    <span className="font-mono">{row.sourceTenantDomain}</span> · to{' '}
                    <span className="font-mono">{row.recipientEmail}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onView(row)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-bg px-2 text-xs text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    data-testid={`inbound-share-view-${row.id}`}
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => onBlockDomain(row.sourceTenantDomain)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-bg px-2 text-xs text-fg-muted hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                    data-testid={`inbound-share-block-${row.id}`}
                  >
                    <ShieldX className="h-3 w-3" aria-hidden="true" />
                    Block domain
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
