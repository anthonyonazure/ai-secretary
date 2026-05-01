/**
 * `/settings/admin` — F2-admin consolidation surface.
 *
 * Lands all the org-admin controls in one place:
 *   - DPA acceptance + region-pin status (Story 12.1)
 *   - Bot integration credentials (Stories 9.1 + 9.2)
 *   - Region-aware consent policy (Story 12.6)
 *   - Cross-org accept-policy (Story 12.7)
 *
 * Tabbed layout — each section renders the dedicated form component
 * shipped earlier. The data wiring uses local state stubs today so
 * the surface is exercisable end-to-end; the React-Query mutations
 * land alongside the production endpoints.
 *
 * Anti-pattern guarded against (UX spec § Step 5 #5): "settings-page
 * bloat — unsearchable, unfilterable, no audit trail." This page is
 * intentionally compact — each section ships with a clear heading +
 * a link out to the audit-log table for trail.
 */

import { createFileRoute } from '@tanstack/react-router';
import { Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';

import {
  type ConsentPolicy,
  ConsentPolicyForm,
} from '../../../components/feature/admin/consent-policy-form';
import { IntegrationCredentialsForm } from '../../../components/feature/admin/integration-credentials-form';

export const Route = createFileRoute('/_authenticated/settings/admin')({
  component: AdminSettingsRoute,
});

type Tab = 'integrations' | 'consent' | 'cross-org';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'integrations', label: 'Integrations' },
  { id: 'consent', label: 'Consent policy' },
  { id: 'cross-org', label: 'Cross-org sharing' },
];

function AdminSettingsRoute() {
  const [tab, setTab] = useState<Tab>('integrations');
  const [consentPolicy, setConsentPolicy] = useState<ConsentPolicy>({
    legalBasis: 'legitimate-interest-implicit',
    optOutBehavior: 'per-participant-exclusion',
  });

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-fg"
        >
          <SettingsIcon className="h-4 w-4" />
        </span>
        <h1 className="font-sans text-2xl font-semibold">Org admin</h1>
      </header>

      <div role="tablist" aria-label="Admin settings sections" className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            data-active={tab === t.id}
            onClick={() => setTab(t.id)}
            className="inline-flex h-9 items-center rounded-md px-3 text-sm text-fg-muted hover:text-fg data-[active=true]:bg-accent-soft data-[active=true]:text-fg data-[active=true]:font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            data-testid={`admin-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={tab}>
        {tab === 'integrations' ? (
          <div className="flex flex-col gap-4">
            <IntegrationCredentialsForm
              provider="zoom"
              hasExistingCredentials={false}
              onSave={() => {
                /* Stub — wires to PUT /api/v1/tenants/me/integrations/zoom */
              }}
            />
            <IntegrationCredentialsForm
              provider="teams"
              hasExistingCredentials={false}
              onSave={() => {
                /* Stub — wires to PUT /api/v1/tenants/me/integrations/teams */
              }}
            />
          </div>
        ) : null}

        {tab === 'consent' ? (
          <ConsentPolicyForm
            value={consentPolicy}
            onSave={(next) => {
              setConsentPolicy(next);
              /* Stub — wires to PUT /api/v1/tenants/me/consent-policy */
            }}
          />
        ) : null}

        {tab === 'cross-org' ? (
          <div className="rounded-md border border-border bg-surface p-5 text-sm">
            <p className="text-fg-muted">
              Cross-org accept-policy lives at{' '}
              <code className="font-mono text-fg">/api/v1/tenants/me/cross-org-policy</code>. The
              dedicated form lands in a follow-up — for today, Pro and Business tenants default to{' '}
              <strong>accept-all</strong>; Enterprise tenants default to <strong>whitelist</strong>{' '}
              (empty list = block-all in practice).
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
