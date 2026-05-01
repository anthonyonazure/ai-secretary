-- =============================================================================
-- Story 3.2 — `module_outputs` table
-- One row per (meeting, module) pair. The summarize worker UPSERTs into
-- this table after the LLM returns a parsed ModuleOutput; the
-- AnalysisCard renderer reads from here.
--
-- See packages/db/src/schema/module-outputs.ts for the Drizzle table.
-- See packages/shared/src/schemas/module-output.ts for the discriminated
-- ModuleOutput union shape that the `output` jsonb column carries.
--
-- RLS policies live in packages/db/rls/0011_rls_module_outputs.sql.
-- Strict in-tenant pattern.
--
-- Erasure cascade: `shred` — analysis content references PII via the
-- citation deep-links it carries. Registered in
-- apps/api/src/lib/erasure-cascade.ts in the same change.
-- =============================================================================

CREATE TABLE module_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  -- Module discriminator — matches ModuleId from @aisecretary/shared
  -- ('general' | 'sales' | 'hr' | 'education' | 'medical' | 'support' |
  --  'pm' | 'psychology'). Stored as TEXT rather than enum so adding a
  -- vertical in Story 5.x doesn't require a migration.
  module_id TEXT NOT NULL,
  -- The discriminated `ModuleOutput` JSON. Schema enforced at the
  -- worker level (parsed against `moduleOutputSchema` before insert).
  output JSONB NOT NULL,
  -- 0.000–1.000 — derived from LLM finish reason + heuristic.
  confidence NUMERIC(4, 3),
  -- Provider kind ('anthropic' | 'openai' | 'azure-openai' | 'bedrock' |
  -- 'ollama' | 'mock') — for ops triage + cost analysis.
  provider_kind TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Re-runs replace via UPSERT keyed on this pair.
CREATE UNIQUE INDEX uq_module_outputs_meeting_id_module_id
  ON module_outputs (meeting_id, module_id);

-- Hot read path: list all module outputs for a meeting.
CREATE INDEX idx_module_outputs_tenant_meeting
  ON module_outputs (tenant_id, meeting_id);
