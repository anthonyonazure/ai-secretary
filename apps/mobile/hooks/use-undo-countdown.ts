/**
 * `deriveUndoCountdown` — UX state for undo banners that appear after a
 * destructive action (mark-done, archive, delete, share-revoke).
 *
 * The host pushes `actionPerformedAtMs` and decrements via a 1s tick;
 * we compute the visible state. After the cooldown the action commits
 * irreversibly and the banner can be dismissed.
 */

export type UndoActionKind =
  | 'mark-done'
  | 'archive-meeting'
  | 'revoke-share'
  | 'delete-action-item'
  | 'snooze-notification';

export type UndoCountdownInput = {
  action: UndoActionKind;
  performedAtMs: number;
  cooldownMs?: number;
  now?: number;
};

export type UndoCountdownState = {
  visible: boolean;
  secondsRemaining: number;
  /** True when the cooldown just expired and we should fire the irreversible commit. */
  shouldCommit: boolean;
  copy: string;
};

const DEFAULT_COOLDOWN_MS = 7_000;

const COPY: Record<UndoActionKind, string> = {
  'mark-done': 'Marked done.',
  'archive-meeting': 'Meeting archived.',
  'revoke-share': 'Share revoked.',
  'delete-action-item': 'Action item deleted.',
  'snooze-notification': 'Notification snoozed.',
};

export const deriveUndoCountdown = (input: UndoCountdownInput): UndoCountdownState => {
  const cooldownMs = input.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const now = input.now ?? Date.now();
  const elapsed = now - input.performedAtMs;
  const remainingMs = cooldownMs - elapsed;

  if (remainingMs <= 0) {
    return {
      visible: false,
      secondsRemaining: 0,
      shouldCommit: elapsed >= cooldownMs && elapsed < cooldownMs + 1_000,
      copy: '',
    };
  }
  return {
    visible: true,
    secondsRemaining: Math.ceil(remainingMs / 1000),
    shouldCommit: false,
    copy: `${COPY[input.action]} Undo in ${Math.ceil(remainingMs / 1000)}s.`,
  };
};
