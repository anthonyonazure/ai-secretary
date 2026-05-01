-- Story 12.1 / ADR-0004 — tenant lifecycle FSM.
--
-- Adds:
--   - `tenant_state` enum
--   - `tenants.state` (default 'dpa_required')
--   - DPA acceptance trail columns
--   - Region-pin one-shot timestamp
--   - `enforce_region_lock` trigger guaranteeing region immutability
--     after the one-shot pin (defense in depth on top of the API gate).
--
-- Forward-only.

CREATE TYPE tenant_state AS ENUM (
  'draft',
  'dpa_required',
  'dpa_accepted',
  'region_pinning',
  'provisioning',
  'active',
  'suspended'
);

ALTER TABLE tenants
  ADD COLUMN state tenant_state NOT NULL DEFAULT 'dpa_required',
  ADD COLUMN dpa_version TEXT,
  ADD COLUMN dpa_accepted_at TIMESTAMPTZ,
  ADD COLUMN dpa_accepted_by_user_id UUID,
  ADD COLUMN region_locked_at TIMESTAMPTZ;

-- Defense-in-depth: once a tenant's region is locked, the row's
-- `region` column cannot change at the storage layer. Mirrors the API
-- one-shot gate at `POST /api/v1/tenants/me/region`.
CREATE OR REPLACE FUNCTION enforce_region_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.region_locked_at IS NOT NULL AND NEW.region IS DISTINCT FROM OLD.region THEN
    RAISE EXCEPTION 'tenants.region is immutable after region-pin (region_locked_at = %)', OLD.region_locked_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_enforce_region_lock
BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION enforce_region_lock();
