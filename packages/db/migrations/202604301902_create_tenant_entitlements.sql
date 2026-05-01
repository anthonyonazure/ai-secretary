-- Story 13.2 / FR38 — tenant entitlements.
--
-- Materialized snapshot of the billing tier's capabilities. Stripe
-- webhook handlers (Story 13.1) write this row transactionally; the
-- `entitlement-check` Fastify plugin reads it at every state-changing
-- route + module dispatch.
--
-- One row per tenant. FK ON DELETE CASCADE from `tenants` so erasure
-- cascade is automatic (registered in `apps/api/src/lib/erasure-cascade.ts`).
--
-- Forward-only.

CREATE TABLE tenant_entitlements (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  tier_id TEXT NOT NULL DEFAULT 'free',
  seat_ceiling INTEGER NOT NULL DEFAULT 1,
  hours_included INTEGER NOT NULL DEFAULT 5,
  enabled_module_ids JSONB NOT NULL DEFAULT '["general"]'::jsonb,
  bot_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sso_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  audit_export_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  cross_org_sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
