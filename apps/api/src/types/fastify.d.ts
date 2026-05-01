/**
 * Fastify request/instance augmentations for `apps/api`.
 *
 * Plugins (`tenant-context`, `audit-logger`, `request-id`) decorate the
 * request via `fastify.decorateRequest`. Listing the resulting fields
 * here keeps the rest of the app type-safe without per-handler casts.
 */
import type { Region } from '@aisecretary/db';
import type { UserRole } from '@aisecretary/shared';
import type { ApiAuditAction } from '../lib/audit-types.js';

export interface RequestUser {
  /** Verified-claim tenant id (Story 1.5). */
  tenantId: string;
  /** Verified-claim user id (Story 1.5). */
  userId: string;
  /** Region pinned to the user's tenant. */
  region: Region;
  /** Verified-claim user role (Story 1.5). */
  role: UserRole;
}

export interface AuditEmitInput {
  action: ApiAuditAction;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  /**
   * Story 8.4 / ADR-0006 — write the audit row against a tenant other
   * than the request's tenant. Used for cross-tenant `share.cross-org-
   * received` rows that must land on the receiving tenant's timeline.
   * Sender-side audits omit this field.
   */
  tenantIdOverride?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Set by `request-id` plugin. Echoed in response header + every log line.
     * Always present.
     */
    requestId: string;
    /**
     * Set by `tenant-context` plugin (after auth). Failing closed with 401
     * if neither a verified JWT claim nor (in non-prod) `x-tenant-id`
     * resolves a value.
     */
    tenantId: string;
    /** Region resolved from deployment env, validated. */
    region: Region;
    /** Populated once Story 1.5 auth lands. Null until then. */
    user: RequestUser | null;
    /**
     * Manual audit-emit hook from `audit-logger` plugin. Throws (HTTP 500)
     * if `action` isn't in the canonical union.
     */
    audit: (input: AuditEmitInput) => Promise<void>;
  }

  interface FastifyContextConfig {
    /**
     * Auto-emit audit rows on successful response. Each tag emits one row
     * with `action` = the tag value. Multiple tags = multiple rows.
     */
    auditTags?: ApiAuditAction[];
    /**
     * Skip the `tenant-context` plugin for this route (health checks +
     * pre-auth /auth routes).
     */
    skipTenantContext?: boolean;
    /**
     * Opt out of the audit-coverage CI walker. Used by routes that are
     * non-GET but don't change tenant-scoped state (e.g. /auth/login,
     * /auth/refresh, /auth/logout — credential management against the
     * refresh-token store, not tenant data). The walker honors this
     * flag; the runtime audit plugin is unaffected (no auto-emit
     * happens regardless).
     */
    skipAudit?: boolean;
  }
}
