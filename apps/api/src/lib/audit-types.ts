import type { NotificationAuditAction } from '@aisecretary/notifications';

/**
 * Canonical audit-action union.
 *
 * Every action that can hit `audit_logs` is listed here. The
 * `audit-logger` plugin throws (HTTP 500) if a handler tries to emit an
 * action that isn't in this union — that enforces the discipline at
 * runtime; the TS union enforces it at build time.
 *
 * Sibling stories that introduce new auditable surfaces extend the union
 * by adding entries to the typed union AND the runtime list:
 *   - Story 4.3 (consent capture)        → `consent.*`
 *   - Story 8.4 (cross-org sharing)      → `share.cross-org-sent`
 *   - Story 12.7 (cross-org policy gate) → `share.cross-org-blocked-by-policy`
 *   - Story 14.1 (DSAR worker)           → `dsar.*`
 *   - Story 13.x (Stripe entitlements)   → `entitlements.*`
 *
 * `NotificationAuditAction` is owned by `packages/notifications` (Story
 * 1.10). It's re-included here so a single union represents the full
 * audit-action surface for the API.
 */
export type ApiAuditAction =
  | NotificationAuditAction
  | 'tenant.created'
  | 'tenant.updated'
  | 'user.created'
  | 'user.role-changed'
  | 'user.mfa-enrolled'
  | 'user.mfa-disabled'
  | 'user.mfa-recovery-codes-regenerated'
  | 'user.mfa-failed-verification'
  | 'meeting.created'
  | 'meeting.updated'
  | 'meeting.deleted'
  | 'meeting.shared'
  | 'meeting.share-revoked'
  | 'meeting.summarized'
  | 'meeting.analyzed'
  | 'meeting.action-items-extracted'
  | 'recording.started'
  | 'recording.stopped'
  | 'recording.aborted'
  | 'recording.at-risk'
  | 'recording.upload-escalated'
  | 'feedback.thumbs-recorded'
  | 'invite.created'
  | 'invite.revoked'
  | 'invite.accepted'
  | 'dsar.requested'
  | 'dsar.export-completed'
  | 'dsar.export-failed'
  | 'share.created'
  | 'share.viewed'
  | 'share.revoked'
  | 'share.cross-org-sent'
  | 'share.cross-org-received'
  | 'action-item.status-updated'
  | 'dsar.erasure-stage'
  | 'dsar.erasure-completed'
  | 'dsar.erasure-failed'
  | 'tenant.trial-started'
  | 'tenant.trial-reminder-sent'
  | 'tenant.trial-converted'
  | 'tenant.trial-expired'
  | 'tenant.trial-extended'
  | 'tenant.dpa-accepted'
  | 'tenant.region-pinned'
  | 'tenant.settings-updated'
  | 'share.cross-org-policy-updated'
  | 'share.cross-org-blocked-by-policy'
  // Bot session FSM (Story 9.x — packages/bot)
  | 'bot.session.provisioned'
  | 'bot.session.joined'
  | 'bot.session.ended'
  | 'bot.session.failed'
  // CRM integrations (Story 15.x / ADR-0003 — packages/crm)
  | 'crm.connected'
  | 'crm.disconnected'
  | 'crm.note-pushed'
  | 'crm.contact-created'
  | 'crm.push-failed';

/**
 * Runtime mirror of `ApiAuditAction`. Used by:
 *   - the `audit-logger` plugin to validate `request.audit({ action })`
 *     calls at runtime
 *   - the `check-audit-coverage` CI script to grep for legal action names
 *
 * MUST stay in sync with `ApiAuditAction`. The `assertAuditActionsExhaustive`
 * helper at the bottom uses TS to fail compilation if they drift.
 */
export const AUDIT_ACTIONS = [
  // Notifications (re-exported set — see packages/notifications/src/audit.ts)
  'notification.sent',
  'notification.failed',
  'notification.suppressed-dedup',
  'notification.opted-out',
  // Tenants
  'tenant.created',
  'tenant.updated',
  // Users
  'user.created',
  'user.role-changed',
  // Users — MFA (Story 1.5c)
  'user.mfa-enrolled',
  'user.mfa-disabled',
  'user.mfa-recovery-codes-regenerated',
  'user.mfa-failed-verification',
  // Meetings
  'meeting.created',
  'meeting.updated',
  'meeting.deleted',
  'meeting.shared',
  'meeting.share-revoked',
  // Meetings — analysis pipeline (Story 3.2 / 3.3)
  'meeting.summarized',
  'meeting.analyzed',
  'meeting.action-items-extracted',
  // Recordings
  'recording.started',
  'recording.stopped',
  'recording.aborted',
  'recording.at-risk',
  'recording.upload-escalated',
  // Feedback
  'feedback.thumbs-recorded',
  // Invites (Story 1.5d)
  'invite.created',
  'invite.revoked',
  'invite.accepted',
  // DSAR (Story 14.1) — note: the `dsar.zip-downloaded` event is NOT
  // audited because the presigned-GET URL goes directly to S3 and the
  // API never sees the request. The three covered events bracket the
  // worker's lifecycle.
  'dsar.requested',
  'dsar.export-completed',
  'dsar.export-failed',
  // Sharing (Stories 8.1–8.4)
  'share.created',
  'share.viewed',
  'share.revoked',
  'share.cross-org-sent',
  'share.cross-org-received',
  // Action items (Story 8.5 — My Actions roll-up)
  'action-item.status-updated',
  // DSAR erasure (Story 14.2 — right-to-erasure cascade)
  'dsar.erasure-stage',
  'dsar.erasure-completed',
  'dsar.erasure-failed',
  // Trial lifecycle (Story 13.7)
  'tenant.trial-started',
  'tenant.trial-reminder-sent',
  'tenant.trial-converted',
  'tenant.trial-expired',
  'tenant.trial-extended',
  // F2-admin (Story 12.1)
  'tenant.dpa-accepted',
  'tenant.region-pinned',
  'tenant.settings-updated',
  // Cross-org policy (Story 12.7)
  'share.cross-org-policy-updated',
  'share.cross-org-blocked-by-policy',
  // Bot session FSM (Story 9.x — packages/bot)
  'bot.session.provisioned',
  'bot.session.joined',
  'bot.session.ended',
  'bot.session.failed',
  // CRM integrations (Story 15.x / ADR-0003 — packages/crm)
  'crm.connected',
  'crm.disconnected',
  'crm.note-pushed',
  'crm.contact-created',
  'crm.push-failed',
] as const satisfies readonly ApiAuditAction[];

export type AuditActionRuntime = (typeof AUDIT_ACTIONS)[number];

const AUDIT_ACTION_SET: ReadonlySet<string> = new Set(AUDIT_ACTIONS);

/** Runtime guard — used by the audit-logger plugin to reject unknown actions. */
export const isCanonicalAuditAction = (value: string): value is AuditActionRuntime =>
  AUDIT_ACTION_SET.has(value);

/**
 * TS-level assertion: `AUDIT_ACTIONS` covers every member of `ApiAuditAction`.
 * If a sibling story adds a string to the union without updating the array,
 * this line fails to compile.
 */
type AssertExhaustive<Union, Tuple extends readonly Union[]> = Exclude<
  Union,
  Tuple[number]
> extends never
  ? true
  : Exclude<Union, Tuple[number]>;
const _exhaustive: AssertExhaustive<ApiAuditAction, typeof AUDIT_ACTIONS> = true;
void _exhaustive;
