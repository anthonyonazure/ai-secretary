/**
 * Audit-action union for notification dispatch.
 *
 * TODO(Story 1.4): merge into apps/api/src/lib/audit-types.ts union once
 * that file lands. Until then, this is the canonical source for these
 * action strings — re-import from here in any consumer that wires the
 * gateway to the audit-logger plugin.
 */
export type NotificationAuditAction =
  | 'notification.sent'
  | 'notification.failed'
  | 'notification.suppressed-dedup'
  | 'notification.opted-out';

import type { NotificationChannel, NotificationKind } from './types.js';

/** The shape of an audit-log entry written by the gateway. */
export interface NotificationAuditEntry {
  action: NotificationAuditAction;
  tenantId: string;
  userId?: string | undefined;
  /** The recipient address (email or userId). Stored verbatim for trail. */
  recipient: string;
  channel: NotificationChannel;
  kind: NotificationKind;
  notificationId: string;
  /** Provider-side message id when known; `undefined` for suppressed entries. */
  providerMessageId?: string | undefined;
  error?: string | undefined;
}

/**
 * Audit-logger injection point. The gateway calls `log()` for every
 * dispatch outcome (sent / failed / suppressed). Story 1.4 will provide
 * the real implementation that fans out to the `audit_logs` table; for
 * now consumers can pass a no-op or a custom impl in tests.
 *
 * TODO(Story 1.4): wire audit-logger plugin instance — replace the
 * default with the real audit-logger plugin once Story 1.4 ships.
 */
export interface AuditLogger {
  log(entry: NotificationAuditEntry): Promise<void>;
}

/** No-op audit logger used by default and in tests. */
export const noopAuditLogger: AuditLogger = {
  async log() {
    // intentionally blank
  },
};
