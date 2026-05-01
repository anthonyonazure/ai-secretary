-- =============================================================================
-- Story 3.3 — `action_items` table
-- One row per explicit, agreed-upon commitment surfaced from a meeting
-- transcript. The extract-action-items worker INSERTs these rows after
-- the LLM returns a parsed `actionItemsOutputSchema` payload.
--
-- See packages/db/src/schema/action-items.ts for the Drizzle table +
-- packages/modules/src/action-items.ts for the LLM-payload schema.
--
-- Lifecycle (FSM):
--   pending → accepted → done
--           ↘ dismissed
--
-- RLS policies live in packages/db/rls/0012_rls_action_items.sql.
-- Strict in-tenant pattern.
--
-- Erasure cascade: `shred` — commitments quote transcript content + may
-- reference user names. Registered in apps/api/src/lib/erasure-cascade.ts.
-- =============================================================================

CREATE TYPE action_item_status AS ENUM ('pending', 'accepted', 'done', 'dismissed');

CREATE TABLE action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  -- Resolved tenant member when the LLM-emitted ownerName matched a
  -- user; null otherwise. Soft FK — preserves the row when a user is
  -- deleted.
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Free-text owner name from the transcript — preserved alongside the
  -- resolved FK so the chip in the UI always renders something.
  owner_name TEXT,
  -- ISO-8601 due date — null when no date was discussed.
  due_date TIMESTAMPTZ,
  -- The action statement (imperative voice per the action-items module
  -- prompt — "Send X to Y", not "I will send X to Y").
  text TEXT NOT NULL,
  status action_item_status NOT NULL DEFAULT 'pending',
  -- 0.000–1.000 — same heuristic family as module_outputs.confidence.
  confidence NUMERIC(4, 3),
  -- Citations grounding the item in transcript spans. Same
  -- `(meetingId, turnId)` contract as ModuleOutput bullets.
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_items_tenant_meeting ON action_items (tenant_id, meeting_id);
CREATE INDEX idx_action_items_owner ON action_items (tenant_id, owner_user_id);
CREATE INDEX idx_action_items_status ON action_items (tenant_id, status);
