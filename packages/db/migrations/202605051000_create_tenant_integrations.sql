-- Story 15.x / ADR-0003 — tenant_integrations table.
--
-- Holds per-tenant CRM (and future) integration credentials. Each row
-- is a connected provider (HubSpot, Salesforce, Pipedrive) for one
-- tenant. The OAuth access_token + refresh_token are stored in
-- `encrypted_token` as KMS-style envelope-encrypted ciphertext (see
-- packages/db/src/lib/envelope-encryption.ts).
--
-- Tenant-scoped (RLS). Workers read across tenants via BYPASSRLS for
-- the `crm.push` queue handler — same convention as recordings /
-- bot_sessions watchdogs.

CREATE TYPE integration_provider AS ENUM ('hubspot', 'salesforce', 'pipedrive');

CREATE TYPE integration_status AS ENUM ('active', 'revoked', 'error');

CREATE TABLE tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider integration_provider NOT NULL,
  /* Provider-native account/portal/org id — used for display + dedup
     ("Already connected to HubSpot Portal 12345"). */
  external_account_id TEXT NOT NULL,
  /* Display label captured at connect-time. Refreshed on whoAmI(). */
  account_label TEXT NOT NULL,
  /* Salesforce only — instance URL the org lives on. */
  instance_url TEXT,
  /* Pipedrive only — per-company API base. */
  api_base_url TEXT,
  /* JSON envelope: { ciphertext, dek, iv, tag, kek_id, alg, version }.
     Wrapped via packages/db/src/lib/envelope-encryption.ts. The dek is
     itself wrapped with the at-rest KEK; rotation is a per-row
     unwrap+rewrap (see docs/runbook/credential-rotation.md). */
  encrypted_token JSONB NOT NULL,
  /* OAuth scopes granted at connect-time. Display-only. */
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status integration_status NOT NULL DEFAULT 'active',
  /* Populated only on transitions into 'error'. */
  failure_reason TEXT,
  /* Bookkeeping. */
  connected_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  last_token_refresh_at TIMESTAMPTZ,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  /* Only one active integration per (tenant, provider). Disconnecting
     flips status to 'revoked' so the partial unique index still admits
     a fresh connect afterwards. */
  CONSTRAINT one_active_provider_per_tenant
    UNIQUE NULLS NOT DISTINCT (tenant_id, provider, status)
);

CREATE UNIQUE INDEX uniq_tenant_integrations_active
  ON tenant_integrations (tenant_id, provider)
  WHERE status = 'active';

CREATE INDEX idx_tenant_integrations_tenant_status
  ON tenant_integrations (tenant_id, status);

CREATE INDEX idx_tenant_integrations_token_expires_at
  ON tenant_integrations (token_expires_at)
  WHERE status = 'active' AND token_expires_at IS NOT NULL;
