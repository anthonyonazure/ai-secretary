import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

/**
 * `tenant_entitlements` — Story 13.2 / FR38.
 *
 * Materialized per-tenant snapshot of the billing tier's capabilities.
 * Stripe webhooks (Story 13.1) update this row transactionally on every
 * `customer.subscription.*` event so request-time enforcement never has
 * to round-trip Stripe.
 *
 * One row per tenant — `tenant_id` is the primary key, no UUID surrogate.
 *
 * Update discipline:
 *   - `entitlement-check` plugin (apps/api/src/plugins/entitlement-check.ts)
 *     reads this row at every state-changing route + module dispatch
 *   - Stripe webhook handler is the only sanctioned writer in production
 *   - The F2-admin auto-activation flow (Story 12.1) seeds the row for
 *     new tenants with sensible defaults from `BILLING_TIERS`
 *
 * Erasure cascade: `cascade` (FK ON DELETE CASCADE from `tenants`).
 */
export const tenantEntitlements = pgTable('tenant_entitlements', {
  /** Primary key — one row per tenant. */
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  /** Plan id — `free | pro | business | enterprise`. */
  tierId: text('tier_id').notNull().default('free'),
  /** Seat ceiling. -1 means unlimited (Enterprise). */
  seatCeiling: integer('seat_ceiling').notNull().default(1),
  /** Monthly meeting-hour cap before overage. -1 = unlimited. */
  hoursIncluded: integer('hours_included').notNull().default(5),
  /** Set of vertical module ids enabled for this tenant. */
  enabledModuleIds: jsonb('enabled_module_ids').$type<string[]>().notNull().default(['general']),
  /**
   * True when the tenant's plan permits the bot service (Zoom + Teams
   * meetings). Pro+; Free is recording-only.
   */
  botEnabled: boolean('bot_enabled').notNull().default(false),
  /** True when SSO is permitted (Business+). */
  ssoEnabled: boolean('sso_enabled').notNull().default(false),
  /** True when audit-log export is permitted (Business+). */
  auditExportEnabled: boolean('audit_export_enabled').notNull().default(false),
  /** True when cross-org sharing is permitted (Pro+). */
  crossOrgSharingEnabled: boolean('cross_org_sharing_enabled').notNull().default(false),
  /** Stripe customer id — null for tenants on the free tier. */
  stripeCustomerId: text('stripe_customer_id'),
  /** Stripe subscription id. */
  stripeSubscriptionId: text('stripe_subscription_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TenantEntitlement = typeof tenantEntitlements.$inferSelect;
export type NewTenantEntitlement = typeof tenantEntitlements.$inferInsert;
