export type OfflineItemKind =
  | 'recording-chunk'
  | 'action-item-update'
  | 'thumbs-feedback'
  | 'consent-ack'
  | 'meeting-edit';

export type OfflineQueueItem = {
  id: string;
  kind: OfflineItemKind;
  enqueuedAtMs: number;
  attemptCount: number;
  sizeBytes: number;
};

export type OfflineQueueInput = {
  items: ReadonlyArray<OfflineQueueItem>;
  isOnline: boolean;
  isSyncing: boolean;
  now?: number;
};

export type OfflineQueueState = {
  banner: 'hidden' | 'offline' | 'syncing' | 'stuck';
  pendingCount: number;
  pendingBytes: number;
  oldestAgeMinutes: number;
  copy: string;
};

const STUCK_AGE_MS = 30 * 60 * 1000;

export const deriveOfflineQueueState = (input: OfflineQueueInput): OfflineQueueState => {
  const now = input.now ?? Date.now();
  const pendingCount = input.items.length;
  const pendingBytes = input.items.reduce((sum, i) => sum + i.sizeBytes, 0);
  const oldestMs =
    pendingCount > 0 ? Math.max(0, now - Math.min(...input.items.map((i) => i.enqueuedAtMs))) : 0;
  const oldestAgeMinutes = Math.floor(oldestMs / 60_000);

  if (pendingCount === 0 && input.isOnline) {
    return {
      banner: 'hidden',
      pendingCount: 0,
      pendingBytes: 0,
      oldestAgeMinutes: 0,
      copy: '',
    };
  }
  if (!input.isOnline) {
    return {
      banner: 'offline',
      pendingCount,
      pendingBytes,
      oldestAgeMinutes,
      copy:
        pendingCount === 0
          ? 'Offline — your work will sync when you reconnect.'
          : `Offline — ${pendingCount} item${pendingCount === 1 ? '' : 's'} queued for sync.`,
    };
  }
  if (oldestMs > STUCK_AGE_MS) {
    return {
      banner: 'stuck',
      pendingCount,
      pendingBytes,
      oldestAgeMinutes,
      copy: `${pendingCount} item${pendingCount === 1 ? '' : 's'} stuck for ${oldestAgeMinutes} min — tap to retry.`,
    };
  }
  if (input.isSyncing) {
    return {
      banner: 'syncing',
      pendingCount,
      pendingBytes,
      oldestAgeMinutes,
      copy: `Syncing ${pendingCount} item${pendingCount === 1 ? '' : 's'}…`,
    };
  }
  return {
    banner: 'syncing',
    pendingCount,
    pendingBytes,
    oldestAgeMinutes,
    copy: `${pendingCount} item${pendingCount === 1 ? '' : 's'} pending.`,
  };
};
