-- =============================================================================
-- Story 4.3 — `packages/consent` foundation
-- Creates the `consents` table — append-only consent acknowledgment ledger.
-- Spec: arch-addendums § 7 + ADR-0005 (PROPOSED).
-- See packages/db/src/schema/consents.ts.
-- =============================================================================

-- Enums --------------------------------------------------------------

CREATE TYPE consent_shape AS ENUM (
  'A',           -- pre-mic modal (recording user, Story 4.3)
  'C',           -- in-person QR/URL ack (Story 4.3)
  'eu-explicit', -- EU per-participant explicit-consent marker (Story 4.3)
  'B',           -- bot TTS implicit (Story 9.5)
  'D'            -- bot chat explicit-optin (Story 9.5)
);

CREATE TYPE consent_legal_basis AS ENUM (
  'legitimate-interest',
  'explicit-consent'
);

CREATE TYPE consent_ack_via AS ENUM (
  'modal',
  'qr-scan',
  'url',
  'bot-tts'
);

-- consents -----------------------------------------------------------

CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_label TEXT,
  shape consent_shape NOT NULL,
  legal_basis consent_legal_basis NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_via consent_ack_via NOT NULL,
  acknowledged_method_metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot-path lookup for the server-side `consentCheck(tenantId, meetingId)` gate.
CREATE INDEX idx_consents_tenant_id_meeting_id
  ON consents (tenant_id, meeting_id);

-- Per-meeting time-ordered index — drives the shape C live attendee-ack list.
CREATE INDEX idx_consents_meeting_id_acknowledged_at
  ON consents (meeting_id, acknowledged_at);

-- RLS policies live in packages/db/rls/0004_rls_consents.sql.
