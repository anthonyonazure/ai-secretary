import { z } from 'zod';

/**
 * Wire contract for the CRM integration surface (Story 15.x / ADR-0003).
 *
 * apps/api implements:
 *   - GET    /api/v1/crm/integrations
 *   - POST   /api/v1/crm/integrations/:provider
 *   - DELETE /api/v1/crm/integrations/:integrationId
 *   - POST   /api/v1/crm/push
 *
 * The Chrome extension + the in-app receipt UI both consume these.
 */

export const crmProviderSchema = z.enum(['hubspot', 'salesforce', 'pipedrive']);
export type CrmProviderWire = z.infer<typeof crmProviderSchema>;

export const integrationStatusSchema = z.enum(['active', 'revoked', 'error']);
export type IntegrationStatusWire = z.infer<typeof integrationStatusSchema>;

/**
 * Connect-request payload.
 *
 * `tokens` carries the OAuth bundle exchanged by the API server (the
 * extension never sees this directly — it lands here through the
 * provider's OAuth callback URL). `instanceUrl` and `apiBaseUrl` are
 * populated for Salesforce + Pipedrive respectively.
 */
export const crmConnectRequestSchema = z.object({
  accessToken: z.string().min(1).max(8192),
  refreshToken: z.string().min(1).max(8192).optional(),
  expiresAt: z.string().datetime().optional(),
  scopes: z.array(z.string()).default([]),
  instanceUrl: z.string().url().optional(),
  apiBaseUrl: z.string().url().optional(),
});
export type CrmConnectRequest = z.infer<typeof crmConnectRequestSchema>;

export const crmIntegrationResponseSchema = z.object({
  id: z.string().uuid(),
  provider: crmProviderSchema,
  externalAccountId: z.string(),
  accountLabel: z.string(),
  instanceUrl: z.string().nullable(),
  apiBaseUrl: z.string().nullable(),
  scopes: z.array(z.string()),
  status: integrationStatusSchema,
  failureReason: z.string().nullable(),
  connectedAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
});
export type CrmIntegrationResponse = z.infer<typeof crmIntegrationResponseSchema>;

export const crmIntegrationListResponseSchema = z.object({
  items: z.array(crmIntegrationResponseSchema),
});
export type CrmIntegrationListResponse = z.infer<typeof crmIntegrationListResponseSchema>;

/**
 * Push-request payload — fired by the receipt UI's "Push to CRM" CTA
 * or by the Chrome extension overlay. The route enqueues a `crm.push`
 * job; the worker handles the actual provider call so a slow CRM
 * doesn't block the request.
 */
export const crmPushRequestSchema = z.object({
  integrationId: z.string().uuid(),
  meetingId: z.string().uuid(),
  /** Email of the contact to associate the note with. Required. */
  contactEmail: z.string().email(),
  contactFirstName: z.string().min(1).max(120).optional(),
  contactLastName: z.string().min(1).max(120).optional(),
  /** Optional deal/opportunity to attach the note to. */
  dealId: z.string().min(1).max(120).optional(),
  /** Whether to create the contact when missing. Defaults to true. */
  createContactIfMissing: z.boolean().default(true),
});
export type CrmPushRequest = z.infer<typeof crmPushRequestSchema>;

export const crmPushResponseSchema = z.object({
  jobId: z.string(),
  /** Server-side opaque key used for both audit + the worker's idempotency key. */
  idempotencyKey: z.string(),
});
export type CrmPushResponse = z.infer<typeof crmPushResponseSchema>;
