/**
 * Erasure-cascade registry.
 *
 * Story 14.x (DSAR) walks this map when fulfilling a tenant data-erasure
 * request. Each tenant-scoped table declares one strategy:
 *
 *   - `cascade-source`  — root of the cascade (the tenant row itself).
 *                         Deleting it cascades through FK ON DELETE rules.
 *   - `cascade`         — covered by an FK CASCADE from the source.
 *                         No explicit handler needed; included for audit.
 *   - `soft-delete`     — flag a `deleted_at` column; preserved for legal
 *                         hold + restore window.
 *   - `shred`           — hard delete + scrub references (presigned URLs,
 *                         blob keys, embeddings) outside Postgres.
 *   - `redact`          — keep the row for analytics / audit trail; replace
 *                         PII columns with placeholders.
 *
 * New tenant-scoped tables MUST register here in the same migration that
 * creates them. The CI typecheck on `EVERY_TENANT_TABLE_HAS_STRATEGY`
 * (see `erasure-cascade.test.ts`) fails if a tenant-scoped Drizzle table
 * is missing.
 *
 * ADR template for new entries: `docs/decisions/000N-erasure-<table>.md`.
 */

export type ErasureStrategy = 'cascade-source' | 'cascade' | 'soft-delete' | 'shred' | 'redact';

export interface ErasureCascadeEntry {
  /** snake_case Postgres table name (matches `pgTable(...)` first arg). */
  table: string;
  strategy: ErasureStrategy;
  /** Free-form note for the DSAR worker / future ADRs. */
  notes: string;
}

/**
 * Tenant-scoped tables, with their erasure strategies. Sorted by
 * cascade-source-first then alphabetical for consistent diffs.
 */
export const ERASURE_CASCADE: readonly ErasureCascadeEntry[] = [
  {
    // TODO(Story 14.x): consumed by DSAR worker handler — root deletion.
    table: 'tenants',
    strategy: 'cascade-source',
    notes: 'Tenant row is the cascade root; FK ON DELETE CASCADE flows from here.',
  },
  {
    // TODO(Story 14.x): consumed by DSAR worker handler — covered by FK cascade.
    table: 'users',
    strategy: 'cascade',
    notes: 'FK ON DELETE CASCADE from tenants. PII (email, mfa secret) erased with row.',
  },
  {
    // TODO(Story 14.x): consumed by DSAR worker handler — explicit shred.
    table: 'meetings',
    strategy: 'shred',
    notes:
      'Audio object key, transcript blobs, vector embeddings, applied-modules metadata — all PII. Hard delete the row + scrub object storage + delete embedding rows.',
  },
  {
    // TODO(Story 14.x): consumed by DSAR worker handler — redact recipient.
    table: 'notifications',
    strategy: 'redact',
    notes:
      'Preserve dispatch trail for analytics/audit; null out `recipient`, replace with placeholder. Payload hash is non-reversible — kept as-is.',
  },
  {
    // TODO(Story 14.x): consumed by DSAR worker handler — redact userId.
    table: 'user_preferences',
    strategy: 'cascade',
    notes: 'FK ON DELETE CASCADE from tenants. Opt-out preferences erased with tenant.',
  },
  {
    // TODO(Story 14.x): consumed by DSAR worker handler — redact, never shred.
    table: 'audit_logs',
    strategy: 'redact',
    notes:
      'Audit trail of the erasure itself MUST survive. Replace `actor_user_id`, `ip_address`, `user_agent`, and PII keys in `metadata` with NULL placeholders; preserve action + resource references.',
  },
  {
    // TODO(Story 14.x): consumed by DSAR worker handler — append-only consent ledger.
    table: 'consents',
    strategy: 'redact',
    notes:
      'Consent acknowledgments are legally significant — preserve the row + timestamps; redact PII columns (acknowledger email/IP/user agent) per arch-addendums § 7. Owned by Story 4.3 (packages/consent).',
  },
  {
    // TODO(Story 14.x): consumed by DSAR worker handler — explicit shred.
    table: 'recordings',
    strategy: 'shred',
    notes:
      'Recording rows reference an S3 object key holding raw audio (PII). Hard delete the row + scrub the underlying object via packages/storage. Owned by Story 2.1.',
  },
  {
    // TODO(Story 14.x): consumed by DSAR worker handler — explicit shred.
    table: 'speaker_turns',
    strategy: 'shred',
    notes:
      'Speaker turn rows carry verbatim transcript text + speaker labels (PII). Hard delete on tenant erasure; the citation deep-link contract (meetingId, turnId) intentionally breaks alongside the parent meeting. Owned by Story 3.5 (absorbs Story 2.4).',
  },
  {
    // TODO(Story 14.x): consumed by DSAR worker handler — covered by FK cascade.
    table: 'feedback_thumbs',
    strategy: 'cascade',
    notes:
      'FK ON DELETE CASCADE from tenants. Per-user thumbs feedback is product telemetry — erased with the tenant; no scrub of object storage required. Owned by Story 1.7.',
  },
  {
    // TODO(Story 14.x): consumed by DSAR worker handler — covered by FK cascade.
    table: 'tenant_invites',
    strategy: 'cascade',
    notes:
      'FK ON DELETE CASCADE from tenants. Pending invite metadata (recipient email + token hash) erased with the tenant. Plaintext tokens are never persisted (only their sha256 hash); no out-of-band scrub required. Owned by Story 1.5d.',
  },
  {
    // Story 14.1: the DSAR-request row itself is metadata. The zip blob
    // it references is PII — `storage_key` must be scrubbed via
    // packages/storage on erasure so the underlying object goes away
    // alongside the row. Preserve the request row + timestamps so the
    // audit trail of the DSAR fulfillment survives the tenant erasure.
    table: 'dsar_requests',
    strategy: 'redact',
    notes:
      'DSAR-request rows track the legal fulfillment of a data-subject access request. Preserve the row + timestamps for the legal trail; redact `download_url`, scrub the underlying object via packages/storage using `storage_key`, then null `storage_key`. Owned by Story 14.1.',
  },
  {
    // Story 3.2: module_outputs carries the discriminated ModuleOutput
    // JSON which embeds citation deep-links into transcript spans
    // (meetingId + turnId + text-derived offsets). All of that is PII
    // by reference — hard delete on tenant erasure.
    table: 'module_outputs',
    strategy: 'shred',
    notes:
      'Module-output rows hold the AnalysisCard payload (title + summary + bullets with citations into speaker_turns). The citation deep-links resolve to transcript text — same PII surface as speaker_turns. Hard delete on tenant erasure; FK CASCADE from meetings keeps the cleanup automatic. Owned by Story 3.2.',
  },
  {
    // Story 3.3: action_items quote transcript commitments verbatim
    // and frequently reference user names in `owner_name`. PII by
    // content; hard delete on erasure.
    table: 'action_items',
    strategy: 'shred',
    notes:
      'Action-item rows quote transcript commitments verbatim and reference user names (owner_name) + structured citations into speaker_turns. PII by content; hard delete. FK CASCADE from meetings handles the cleanup. Owned by Story 3.3.',
  },
  {
    // Story 8.1: sender-side share grants. FK CASCADE from tenants
    // erases all rows when the tenant is erased; cross-org mirrors
    // remain on the receiving tenant via inbound_shares.
    table: 'shares',
    strategy: 'cascade',
    notes:
      'Sender-side share grants. FK ON DELETE CASCADE from tenants. Cross-org sends remain visible to the receiver via inbound_shares which carries no FK back. Owned by Story 8.1.',
  },
  {
    // Story 8.4 / ADR-0006: receiving-tenant inbound shares. On the
    // RECEIVING tenant cascade source, FK CASCADE erases everything.
    // On a cross-region SENDER-side erasure, redact source_user_email
    // + recipient_email and preserve the row for the receiver's audit
    // trail.
    table: 'inbound_shares',
    strategy: 'redact',
    notes:
      'Receiving-tenant audit trail of inbound shares. Preserve the row + status timeline; redact source_user_email + recipient_email on cross-region sender erasure. On the receiving-tenant cascade-source erasure, hard delete via the FK CASCADE. Owned by Story 8.4 / ADR-0006.',
  },
  {
    // Story 13.2: per-tenant entitlement snapshot. FK ON DELETE CASCADE
    // from tenants makes erasure automatic; nothing PII-specific lives
    // here, only the materialized view of the billing tier.
    table: 'tenant_entitlements',
    strategy: 'cascade',
    notes:
      'Per-tenant entitlement snapshot keyed on tenant_id. FK ON DELETE CASCADE handles the erasure automatically. Stripe customer/subscription ids may be present; their plaintext is non-sensitive (they identify the tenant on Stripe, not a user). Owned by Story 13.2.',
  },
  {
    // Story 7.1: pgvector embeddings tables. Hard-delete on tenant
    // erasure (the vectors plus their source_text are PII by content;
    // see speaker_turns shred rationale).
    table: 'embeddings_1536',
    strategy: 'shred',
    notes:
      'Vector + source_text both encode transcript content. Hard delete via FK CASCADE from meetings + tenants. Owned by Story 7.1.',
  },
  {
    table: 'embeddings_1024',
    strategy: 'shred',
    notes:
      'Same shape as embeddings_1536; per-dimension table for the EU + medical embedding model family. Hard delete via FK CASCADE. Owned by Story 7.1.',
  },
  {
    // Story 9.x: producer-side bot session FSM rows. FK CASCADE from
    // tenants handles the erasure automatically. external_meeting_id
    // is opaque (Zoom meeting number / Teams join URL); the passcode
    // is sensitive but lives on the row that itself cascades away.
    // Keep nothing afterwards.
    table: 'bot_sessions',
    strategy: 'cascade',
    notes:
      'Bot session FSM rows. FK ON DELETE CASCADE from tenants handles erasure; external_meeting_passcode is sensitive but the row itself goes away. Owned by Story 9.x (packages/bot).',
  },
  {
    // Story 15.x / ADR-0003: connected CRM integrations (HubSpot,
    // Salesforce, Pipedrive). FK CASCADE from tenants handles
    // erasure; the encrypted_token envelope is destroyed alongside
    // the row, so the wrapped DEK becomes unrecoverable. The remote
    // OAuth grant on the CRM side must be revoked separately by the
    // tenant-close flow before this cascade runs (see
    // docs/runbook/tenant-close.md).
    table: 'tenant_integrations',
    strategy: 'cascade',
    notes:
      'CRM OAuth tokens (envelope-encrypted). FK CASCADE from tenants handles erasure; remote OAuth grant must be revoked separately. Owned by Story 15.x (packages/crm) / ADR-0003.',
  },
] as const;

/** Lookup helper — used by the DSAR worker and the coverage test. */
export const getErasureStrategy = (table: string): ErasureStrategy | undefined => {
  return ERASURE_CASCADE.find((e) => e.table === table)?.strategy;
};

/** All registered table names. */
export const erasureTables = (): string[] => ERASURE_CASCADE.map((e) => e.table);
