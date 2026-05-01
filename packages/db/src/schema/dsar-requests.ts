import { bigint, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * `dsar_requests` — Story 14.1 (self-service DSAR endpoint + ≤24h zip
 * export + email notification).
 *
 * One row per data-subject access request. The `dsar.export` worker
 * picks queued rows up, walks the erasure-cascade registry to assemble
 * the user's data into a zip, uploads the zip to S3, mints a 7-day
 * presigned-GET URL, and dispatches `kind: 'dsar-ready'` email via
 * `packages/notifications`.
 *
 * Lifecycle (FSM):
 *
 *   queued → processing → ready    (success path)
 *                       ↘ failed   (worker exception)
 *                         expired  (7d TTL elapsed)
 *
 * Tenant-scoped (RLS). RLS policies live in
 * `packages/db/rls/0010_rls_dsar_requests.sql`. The strict in-tenant
 * pattern applies — the requester only ever sees their own rows.
 *
 * Erasure cascade: `redact` (the request row itself is metadata; the
 * zip blob it references must be scrubbed via `storage_key` so the
 * delete flow knows what to remove from object storage).
 */
export const dsarRequests = pgTable(
  'dsar_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** The user who filed the request — only this user can read the row. */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /**
     * Lifecycle status. CHECK constraint enforced in the migration.
     * Values: 'queued' | 'processing' | 'ready' | 'failed' | 'expired'.
     */
    status: text('status').notNull().default('queued'),
    /** Set when `status='ready'` — presigned-GET URL into the zip in S3. */
    downloadUrl: text('download_url'),
    /** Absolute expiry of the presigned URL (independent of `expires_at`). */
    downloadExpiresAt: timestamp('download_expires_at', { withTimezone: true }),
    /**
     * S3 storage key for the zip blob. Independent of `download_url` so
     * we can re-presign on URL expiry without re-running the export.
     */
    storageKey: text('storage_key'),
    /** Bytes — informational, surfaced in the dispatched email. */
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    /** Populated when `status='failed'`; truncated to 500 chars in the worker. */
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Set when status flips to 'ready'. */
    readyAt: timestamp('ready_at', { withTimezone: true }),
    /**
     * Soft-expiry; the worker also writes status='expired' when the TTL
     * elapses. Default is `created_at + 7d`, set in the API on insert.
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    /** Hot lookup — list one user's DSAR requests. */
    idxDsarRequestsTenantUser: index('idx_dsar_requests_tenant_user').on(t.tenantId, t.userId),
    /** Idempotent insert guard — used by the in-memory shim + tests. */
    uniqDsarRequestsTenantUserCreated: uniqueIndex(
      'uniq_dsar_requests_tenant_id_user_id_created_at',
    ).on(t.tenantId, t.userId, t.createdAt),
  }),
);

export type DsarRequest = typeof dsarRequests.$inferSelect;
export type NewDsarRequest = typeof dsarRequests.$inferInsert;
