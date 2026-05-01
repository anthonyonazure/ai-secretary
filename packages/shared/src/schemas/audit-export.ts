/**
 * Audit-log export wire schemas — Story 14.5.
 *
 * Org admins export their tenant's audit log for compliance evidence.
 * Tenant scoping is enforced via RLS at the DB layer; the route only
 * adds the `org_admin` role check on top.
 *
 * Output formats:
 *   - `application/json` (default) — array of normalized rows
 *   - `text/csv` — one header row + one row per audit entry
 */

import { z } from 'zod';

export const auditExportFormatSchema = z.enum(['json', 'csv']);
export type AuditExportFormat = z.infer<typeof auditExportFormatSchema>;

export const auditExportQuerySchema = z.object({
  format: auditExportFormatSchema.default('json'),
  /** ISO 8601 lower bound — inclusive. Default: 30 days ago. */
  since: z.string().datetime().optional(),
  /** ISO 8601 upper bound — exclusive. Default: now. */
  until: z.string().datetime().optional(),
  /** Filter by canonical action — comma-separated. */
  action: z.string().optional(),
  /** Filter by resource type. */
  resourceType: z.string().optional(),
  /** Hard cap on row count to keep responses bounded. */
  limit: z.coerce.number().int().min(1).max(10_000).default(1000),
});
export type AuditExportQuery = z.infer<typeof auditExportQuerySchema>;

export const auditExportRowSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  requestId: z.string().nullable(),
  region: z.string(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type AuditExportRow = z.infer<typeof auditExportRowSchema>;

export const auditExportResponseSchema = z.object({
  items: z.array(auditExportRowSchema),
  totalCount: z.number().int().min(0),
  /** Echo the resolved range so the caller can persist evidence boundaries. */
  range: z.object({
    since: z.string().datetime(),
    until: z.string().datetime(),
  }),
});
export type AuditExportResponse = z.infer<typeof auditExportResponseSchema>;
