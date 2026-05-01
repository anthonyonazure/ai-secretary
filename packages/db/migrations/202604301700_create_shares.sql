-- Story 8.1 — sender-side shares table.

CREATE TYPE share_kind AS ENUM ('meeting', 'clip', 'insight', 'token-url');
CREATE TYPE share_scope AS ENUM ('owner', 'editor', 'viewer');

CREATE TABLE shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  kind share_kind NOT NULL,
  scope share_scope NOT NULL DEFAULT 'viewer',
  recipient_email TEXT,
  recipient_user_id UUID REFERENCES users(id),
  /* SHA-256 hex of the plaintext token URL — never store plaintext. */
  token_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id UUID REFERENCES users(id),
  /* Clip span (ms) for kind='clip'. */
  clip_start_ms BIGINT,
  clip_end_ms BIGINT,
  /* Module id for kind='insight'. */
  insight_module_id TEXT,
  /* Cross-org flag — drives the inbound_shares mirror write. */
  cross_org TEXT NOT NULL DEFAULT 'false' CHECK (cross_org IN ('true', 'false')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shares_tenant_meeting ON shares (tenant_id, meeting_id);
CREATE INDEX idx_shares_tenant_recipient ON shares (tenant_id, recipient_email);
CREATE UNIQUE INDEX uq_shares_token_hash ON shares (token_hash) WHERE token_hash IS NOT NULL;
