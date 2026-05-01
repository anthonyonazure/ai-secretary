/**
 * `deriveNotificationPreferences` — derives effective per-channel and
 * per-kind opt-out for the user from a flat `user_preferences` row plus
 * a tenant-wide policy override.
 *
 * Matched 1:1 with `packages/notifications/src/dedup.ts` recipient logic
 * — the gateway suppresses sends here when this returns `false` for the
 * (kind, channel) pair.
 */

export type NotificationChannel = 'push' | 'email' | 'in-app';

export type NotificationKind =
  | 'analysis-completed'
  | 'capture-at-risk'
  | 'upload-retry-budget-exhausted'
  | 'meeting-receipt-slack'
  | 'meeting-receipt-teams'
  | 'meeting-receipt-crm-note'
  | 'lms-grade-passback'
  | 'lms-deeplink-launched'
  | 'dsar-failed'
  | 'tenant-invite'
  | 're-engagement-24h'
  | 're-engagement-72h'
  | 'trial-reminder';

export type NotificationPreferenceInput = {
  userOptOuts: ReadonlyArray<{ channel: NotificationChannel; kind: NotificationKind }>;
  /** Tenant-wide channel kill switches (e.g., HIPAA tenant disables email entirely). */
  tenantDisabledChannels: ReadonlyArray<NotificationChannel>;
  /** Tenant policy can also force certain kinds off (e.g., re-engagement disabled). */
  tenantDisabledKinds: ReadonlyArray<NotificationKind>;
  isTransactionalKind: boolean;
};

export type NotificationPreferenceResult = {
  shouldDeliver: boolean;
  reason: 'user-opt-out' | 'tenant-channel-off' | 'tenant-kind-off' | 'allowed';
};

const TRANSACTIONAL_KINDS: ReadonlySet<NotificationKind> = new Set([
  'capture-at-risk',
  'upload-retry-budget-exhausted',
  'tenant-invite',
  'dsar-failed',
]);

export const isTransactionalNotificationKind = (kind: NotificationKind): boolean =>
  TRANSACTIONAL_KINDS.has(kind);

export const evaluateNotificationPreference = (
  kind: NotificationKind,
  channel: NotificationChannel,
  input: Omit<NotificationPreferenceInput, 'isTransactionalKind'>,
): NotificationPreferenceResult => {
  const isTransactional = TRANSACTIONAL_KINDS.has(kind);

  // Transactional notifications bypass tenant kind kill-switch (e.g., a
  // capture-at-risk ping must reach the user even if the tenant has
  // re-engagement off). They DO still respect channel kill-switches —
  // a tenant with no email provider can't email.
  if (input.tenantDisabledChannels.includes(channel)) {
    return { shouldDeliver: false, reason: 'tenant-channel-off' };
  }
  if (!isTransactional && input.tenantDisabledKinds.includes(kind)) {
    return { shouldDeliver: false, reason: 'tenant-kind-off' };
  }
  const optedOut = input.userOptOuts.some((p) => p.channel === channel && p.kind === kind);
  if (!isTransactional && optedOut) {
    return { shouldDeliver: false, reason: 'user-opt-out' };
  }
  return { shouldDeliver: true, reason: 'allowed' };
};
