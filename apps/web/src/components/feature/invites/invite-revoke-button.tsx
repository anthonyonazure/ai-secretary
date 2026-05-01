/**
 * Story 1.5d — invite revoke button (web).
 *
 * Confirms before firing — the underlying mutation is irreversible
 * (revoke is permanent; the recipient gets a 410 Gone next time they
 * try to accept). One-step `window.confirm` is the lightest-weight
 * confirm; richer modal lives in a future polish story.
 */

import type { ReactElement } from 'react';

export interface InviteRevokeButtonProps {
  inviteId: string;
  onRevoke: (inviteId: string) => Promise<void> | void;
  isRevoking: boolean;
}

export function InviteRevokeButton({
  inviteId,
  onRevoke,
  isRevoking,
}: InviteRevokeButtonProps): ReactElement {
  return (
    <button
      type="button"
      data-testid={`invite-revoke-${inviteId}`}
      disabled={isRevoking}
      onClick={() => {
        if (typeof window !== 'undefined' && !window.confirm('Revoke this invite?')) {
          return;
        }
        void onRevoke(inviteId);
      }}
      className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
    >
      Revoke
    </button>
  );
}
