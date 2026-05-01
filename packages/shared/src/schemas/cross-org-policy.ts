/**
 * Cross-org sharing accept-policy wire schemas — Story 12.7 (FR74).
 *
 * Receiving-side policy that decides whether inbound shares from
 * other tenants are visible to recipients. Three options:
 *   - 'accept-all'     — every cross-org share lands in the recipient's
 *                        view (sender + recipient both succeed)
 *   - 'whitelist'      — only senders whose tenant domain is in
 *                        `whitelist` are accepted; others land in the
 *                        receiving tenant's `inbound_shares` table with
 *                        `status = 'blocked-by-policy'`
 *   - 'block-all'      — every cross-org share blocks at view-time
 *
 * Senders ALWAYS succeed at the create-share call — this policy only
 * controls the receiving-tenant view-time gate. The sender-side audit
 * trail (`share.cross-org-sent`) fires regardless.
 */

import { z } from 'zod';

export const crossOrgPolicyKindSchema = z.enum(['accept-all', 'whitelist', 'block-all']);
export type CrossOrgPolicyKind = z.infer<typeof crossOrgPolicyKindSchema>;

export const crossOrgPolicyResponseSchema = z.object({
  kind: crossOrgPolicyKindSchema,
  /** Whitelisted sender-tenant domains (only meaningful for `'whitelist'`). */
  whitelist: z.array(z.string()),
  /** ISO 8601 — when the policy was last updated. */
  updatedAt: z.string().datetime(),
});
export type CrossOrgPolicyResponse = z.infer<typeof crossOrgPolicyResponseSchema>;

export const updateCrossOrgPolicyRequestSchema = z.object({
  kind: crossOrgPolicyKindSchema,
  /** Whitelisted sender-tenant domains. Required when `kind === 'whitelist'`. */
  whitelist: z.array(z.string().min(1).max(253)).max(500).optional(),
});
export type UpdateCrossOrgPolicyRequest = z.infer<typeof updateCrossOrgPolicyRequestSchema>;
