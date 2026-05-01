/**
 * `deriveMeetingActionBar` — derives the action bar at the bottom of
 * the mobile meeting-detail screen. Different actions become visible
 * based on the meeting's lifecycle state, the user's role, and the
 * vertical's PHI containment policy.
 */

export type MeetingLifecycle = 'pending-upload' | 'transcribing' | 'analyzing' | 'ready' | 'failed';

export type MeetingActionBarInput = {
  lifecycle: MeetingLifecycle;
  isOwner: boolean;
  isAdmin: boolean;
  hasShareEntitlement: boolean;
  hasCrmEntitlement: boolean;
  hasLmsEntitlement: boolean;
  isClinicalVertical: boolean;
};

export type MeetingActionId =
  | 'share'
  | 'export'
  | 'push-to-crm'
  | 'lms-grade'
  | 'reanalyze'
  | 'delete'
  | 'request-correction';

export type MeetingActionEntry = {
  id: MeetingActionId;
  label: string;
  enabled: boolean;
  disabledReason: string | null;
  primary: boolean;
};

export const deriveMeetingActionBar = (
  input: MeetingActionBarInput,
): ReadonlyArray<MeetingActionEntry> => {
  const lifecycleReady = input.lifecycle === 'ready';
  const lifecycleFailed = input.lifecycle === 'failed';

  const entries: MeetingActionEntry[] = [];

  entries.push({
    id: 'share',
    label: 'Share',
    enabled: lifecycleReady && input.hasShareEntitlement,
    disabledReason: lifecycleReady
      ? input.hasShareEntitlement
        ? null
        : 'Sharing requires the Pro tier.'
      : 'Available once analysis completes.',
    primary: true,
  });

  entries.push({
    id: 'export',
    label: 'Export',
    enabled: lifecycleReady,
    disabledReason: lifecycleReady ? null : 'Available once analysis completes.',
    primary: false,
  });

  if (input.hasCrmEntitlement) {
    entries.push({
      id: 'push-to-crm',
      label: 'Push to CRM',
      enabled: lifecycleReady,
      disabledReason: lifecycleReady ? null : 'Available once analysis completes.',
      primary: false,
    });
  }

  if (input.hasLmsEntitlement) {
    entries.push({
      id: 'lms-grade',
      label: 'Grade via LMS',
      enabled: lifecycleReady,
      disabledReason: lifecycleReady ? null : 'Available once analysis completes.',
      primary: false,
    });
  }

  if (input.isOwner || input.isAdmin) {
    entries.push({
      id: 'reanalyze',
      label: 'Re-analyze',
      enabled: lifecycleReady || lifecycleFailed,
      disabledReason: lifecycleReady || lifecycleFailed ? null : 'Wait for the current run.',
      primary: false,
    });
  }

  if (!input.isClinicalVertical && (input.isOwner || input.isAdmin)) {
    entries.push({
      id: 'request-correction',
      label: 'Request correction',
      enabled: true,
      disabledReason: null,
      primary: false,
    });
  }

  if (input.isOwner || input.isAdmin) {
    entries.push({
      id: 'delete',
      label: 'Delete',
      enabled: !input.isClinicalVertical || input.isAdmin,
      disabledReason:
        input.isClinicalVertical && !input.isAdmin
          ? 'Clinical records can only be deleted by an admin.'
          : null,
      primary: false,
    });
  }

  return entries;
};
