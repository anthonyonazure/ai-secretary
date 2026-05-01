-- Story 8.4 / ADR-0006 — receiving-tenant inbound shares.

CREATE TYPE inbound_share_kind AS ENUM ('meeting', 'clip', 'insight', 'token-url');

CREATE TYPE inbound_share_status AS ENUM (
  'pending',
  'accepted',
  'blocked-by-policy',
  'expired',
  'revoked'
);

CREATE TABLE inbound_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  /* No FK on source_tenant_id — sender may live in another region's DB. */
  source_tenant_id UUID NOT NULL,
  source_tenant_domain TEXT NOT NULL,
  source_user_email TEXT NOT NULL,
  source_share_id UUID NOT NULL,
  kind inbound_share_kind NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID REFERENCES users(id),
  resource_label TEXT NOT NULL,
  token_url_hash TEXT,
  status inbound_share_status NOT NULL DEFAULT 'pending',
  policy_evaluated_at TIMESTAMPTZ,
  policy_decision_reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_shares_tenant_status_created
  ON inbound_shares (tenant_id, status, created_at DESC);
CREATE INDEX idx_inbound_shares_tenant_recipient
  ON inbound_shares (tenant_id, recipient_email);
CREATE INDEX idx_inbound_shares_tenant_source_domain
  ON inbound_shares (tenant_id, source_tenant_domain);
CREATE UNIQUE INDEX uq_inbound_shares_source ON inbound_shares (tenant_id, source_share_id);
