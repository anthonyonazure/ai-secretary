-- Story 1.5b — OAuth identity links.

CREATE TYPE oauth_provider AS ENUM ('google', 'microsoft');

CREATE TABLE auth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider oauth_provider NOT NULL,
  provider_user_id TEXT NOT NULL,
  provider_email TEXT,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_auth_identities_provider ON auth_identities (provider, provider_user_id);
CREATE INDEX idx_auth_identities_user ON auth_identities (user_id);
