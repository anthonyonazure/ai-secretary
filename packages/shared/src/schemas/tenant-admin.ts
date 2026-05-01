/**
 * Tenant admin (F2-admin) wire schemas — Story 12.1 (FR72 substrate).
 *
 *   GET /api/v1/tenants/me/state   → onboarding-progress source of truth
 *   POST /api/v1/tenants/me/dpa    → accept DPA
 *   POST /api/v1/tenants/me/region → one-shot region pin
 */

import { z } from 'zod';

export const tenantStateSchema = z.enum([
  'draft',
  'dpa_required',
  'dpa_accepted',
  'region_pinning',
  'provisioning',
  'active',
  'suspended',
]);
export type TenantState = z.infer<typeof tenantStateSchema>;

export const tenantStateResponseSchema = z.object({
  tenantId: z.string().uuid(),
  state: tenantStateSchema,
  /** Boolean — DPA accepted yet? */
  dpaAccepted: z.boolean(),
  /** Boolean — region pinned yet? */
  regionPinned: z.boolean(),
  region: z.enum(['us', 'eu']),
  /** Convenience array — completed step ids for the F2-admin progress UI. */
  completedSteps: z.array(
    z.enum(['dpa', 'region', 'disclosure', 'retention', 'modules', 'invites']),
  ),
});
export type TenantStateResponse = z.infer<typeof tenantStateResponseSchema>;

export const acceptDpaRequestSchema = z.object({
  /** Version string of the DPA the admin is accepting. */
  dpaVersion: z.string().min(1).max(120),
});
export type AcceptDpaRequest = z.infer<typeof acceptDpaRequestSchema>;

export const pinRegionRequestSchema = z.object({
  region: z.enum(['us', 'eu']),
});
export type PinRegionRequest = z.infer<typeof pinRegionRequestSchema>;
