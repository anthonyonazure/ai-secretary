import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const regionEnum = pgEnum('region', ['us', 'eu']);
export const tenantPlanEnum = pgEnum('tenant_plan', [
  'trial',
  'starter',
  'professional',
  'enterprise',
]);
/**
 * Story 13.7 / ADR-0004 — distinguishes trial flavor for downstream
 * gating logic. NULL when the tenant is not in trial.
 */
export const tenantTrialKindEnum = pgEnum('tenant_trial_kind', [
  'pro',
  'business',
  'enterprise_pilot',
]);

/**
 * Story 12.1 / ADR-0004 — tenant lifecycle FSM. Drives the F2-admin
 * first-launch capability-gate progression:
 *
 *   draft → dpa_required → dpa_accepted → region_pinning → provisioning → active
 *                                                                         ↘ suspended
 *
 * The `tenant-state-check` plugin in `apps/api/src/plugins/tenant-state-check.ts`
 * rejects mutating recording-pipeline routes when state is not in
 * `{active, provisioning}`.
 */
export const tenantStateEnum = pgEnum('tenant_state', [
  'draft',
  'dpa_required',
  'dpa_accepted',
  'region_pinning',
  'provisioning',
  'active',
  'suspended',
]);

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  region: regionEnum('region').notNull(),
  plan: tenantPlanEnum('plan').notNull().default('trial'),
  /** HIPAA / GDPR / etc. compliance posture flags — drives provider routing in llm-gateway. */
  compliancePosture: jsonb('compliance_posture')
    .notNull()
    .$type<{
      hipaa?: boolean;
      bookGdpr?: boolean;
      customManagedKeys?: boolean;
      allowedLlmProviders?: Array<'anthropic' | 'openai' | 'azure-openai' | 'bedrock' | 'ollama'>;
    }>()
    .default({}),
  /** Customer-managed KMS key ARN, when enabled. */
  kmsKeyArn: text('kms_key_arn'),
  /**
   * Story 1.5c — org-wide MFA enforcement. When `true`, every user in
   * the tenant must clear an MFA challenge on login. Users without an
   * existing TOTP enrollment receive an `enrollmentRequired: true` flag
   * on the challenge response so the client routes them through
   * enrollment before issuing a session.
   */
  mfaRequired: boolean('mfa_required').notNull().default(false),
  /**
   * Story 13.7 — trial state tracking (per ADR-0004 trial-fields).
   * `trialKind` distinguishes Pro / Business / Enterprise pilot for
   * downstream upgrade-vs-sales-handoff logic; the *_at fields drive
   * the T-3d / T-1d reminder scan; `trialCardOnFile` is the auto-
   * convert decision input.
   */
  trialKind: tenantTrialKindEnum('trial_kind'),
  trialStartsAt: timestamp('trial_starts_at', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  trialCardOnFile: boolean('trial_card_on_file').notNull().default(false),
  /**
   * Set when the trial elapses without a card on file. Pro tenants in
   * this state lose state-changing mutations (recording / share creation)
   * but keep read-only access + DSAR + admin actions.
   */
  trialExpiredAt: timestamp('trial_expired_at', { withTimezone: true }),
  /**
   * Story 12.1 — tenant lifecycle FSM. New tenants start at
   * `dpa_required`; the F2-admin flow walks them through DPA + region
   * + provisioning to `active`.
   */
  state: tenantStateEnum('state').notNull().default('dpa_required'),
  /** DPA acceptance trail. */
  dpaVersion: text('dpa_version'),
  dpaAcceptedAt: timestamp('dpa_accepted_at', { withTimezone: true }),
  dpaAcceptedByUserId: uuid('dpa_accepted_by_user_id'),
  /** Region-pin one-shot — null until pinned, then immutable. */
  regionLockedAt: timestamp('region_locked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
