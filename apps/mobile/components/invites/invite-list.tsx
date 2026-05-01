/**
 * Story 1.5d — admin invites list (mobile).
 *
 * Native counterpart to apps/web/src/components/feature/invites/
 * invite-list.tsx. Shows pending + historical invites with a small
 * state badge per row.
 */

import type { Invite } from '@aisecretary/shared/schemas/invites';
import { Pressable, Text, View } from 'react-native';

export interface InviteListProps {
  invites: ReadonlyArray<Invite>;
  onRevoke?: (inviteId: string) => Promise<void> | void;
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
      <View testID="invite-list-empty" className="rounded-md border border-border bg-surface p-6">
        <Text className="text-center text-sm text-fg-muted">
          No invites yet. Send your first one above.
        </Text>
      </View>
    );
  }
  return (
    <View testID="invite-list" className="flex-col gap-3">
      {invites.map((invite) => {
        const state = inviteState(invite);
        return (
          <View
            key={invite.id}
            testID={`invite-row-${invite.id}`}
            className="flex-col gap-2 rounded-md border border-border bg-bg-elevated p-4"
          >
            <Text className="text-sm font-medium text-fg">{invite.email}</Text>
            <Text className="text-xs text-fg-muted">
              {invite.role} · invited by {invite.invitedBy.name}
            </Text>
            <View className="flex-row items-center justify-between">
              <Text testID={`invite-state-${invite.id}`} className="text-xs text-fg-muted">
                {stateLabel[state]}
              </Text>
              {state === 'pending' && onRevoke ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !!isRevoking }}
                  disabled={!!isRevoking}
                  onPress={() => {
                    void onRevoke(invite.id);
                  }}
                  testID={`invite-revoke-${invite.id}`}
                  className={`min-h-9 items-center justify-center rounded-md border border-border px-3 ${
                    isRevoking ? 'opacity-60' : ''
                  }`}
                >
                  <Text className="text-sm font-medium text-fg">Revoke</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
