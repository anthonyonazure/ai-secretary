/**
 * Story 1.5d — admin invites list (web).
 *
 * Renders the pending + historical invites for a tenant. Each row
 * surfaces email, role, expiry, and a state badge:
 *   - "Accepted"   — green badge; row is read-only
 *   - "Revoked"    — muted badge; row is read-only
 *   - "Expired"    — amber badge; row is read-only
 *   - "Pending"    — neutral badge; admin can revoke
 *
 * The component is presentational — wiring (queries, mutations)
 * happens at the route level via `useInvitesList` + `useRevokeInvite`.
 */

import type { Invite } from '@aisecretary/shared/schemas/invites';
import { InviteRevokeButton } from './invite-revoke-button';

export interface InviteListProps {
  invites: ReadonlyArray<Invite>;
  /** When supplied, each pending row renders a revoke button. */
  onRevoke?: (inviteId: string) => Promise<void> | void;
  /** Disables the revoke button (caller is mid-mutation). */
  isRevoking?: boolean;
}

type InviteState = 'pending' | 'accepted' | 'revoked' | 'expired';

const inviteState = (invite: Invite): InviteState => {
  if (invite.acceptedAt) return 'accepted';
  if (invite.revokedAt) return 'revoked';
  if (new Date(invite.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'pending';
};

const stateLabel: Record<InviteState, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  revoked: 'Revoked',
  expired: 'Expired',
};

export function InviteList({ invites, onRevoke, isRevoking }: InviteListProps) {
  if (invites.length === 0) {
    return (
      <div
        data-testid="invite-list-empty"
        className="rounded-md border border-border bg-surface p-6 text-center text-sm text-fg-muted"
      >
        No invites yet. Send your first one above.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="invite-list">
      {invites.map((invite) => {
        const state = inviteState(invite);
        return (
          <li
            key={invite.id}
            data-testid={`invite-row-${invite.id}`}
            className="flex flex-col gap-2 rounded-md border border-border bg-bg-elevated p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-1">
              <span className="font-sans text-sm font-medium text-fg">{invite.email}</span>
              <span className="text-xs text-fg-muted">
                {invite.role} · invited by {invite.invitedBy.name} ·{' '}
                {new Date(invite.createdAt).toLocaleDateString()}
              </span>
              <span className="text-xs text-fg-muted">
                Expires {new Date(invite.expiresAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span
                data-state={state}
                data-testid={`invite-state-${invite.id}`}
                className="inline-flex h-7 items-center rounded-md border border-border bg-bg px-2 text-xs font-medium text-fg-muted data-[state=accepted]:text-accent data-[state=revoked]:text-fg-muted data-[state=expired]:text-fg"
              >
                {stateLabel[state]}
              </span>
              {state === 'pending' && onRevoke ? (
                <InviteRevokeButton
                  inviteId={invite.id}
                  onRevoke={onRevoke}
                  isRevoking={isRevoking ?? false}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
