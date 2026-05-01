-- Story 13.7 / ADR-0004 — trial state tracking on tenants.
--
-- Adds the four trial fields the trial-reminder cron + Stripe webhook
-- handlers need: trial flavor, lifecycle timestamps, card-on-file
-- boolean for auto-convert decisions, expired-at marker for tenants
-- that elapsed without payment info.
--
-- Forward-only; no down migration per CLAUDE.md migration policy.

CREATE TYPE tenant_trial_kind AS ENUM ('pro', 'business', 'enterprise_pilot');

ALTER TABLE tenants
  ADD COLUMN trial_kind tenant_trial_kind,
  ADD COLUMN trial_starts_at TIMESTAMPTZ,
  ADD COLUMN trial_ends_at TIMESTAMPTZ,
  ADD COLUMN trial_card_on_file BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN trial_expired_at TIMESTAMPTZ;

-- Hot path: the trial-scan worker filters by trial_ends_at within a
-- small window (T-3d / T-1d). Index makes that scan O(log n).
CREATE INDEX idx_tenants_trial_ends_at ON tenants (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;
