import type { Invite } from '@aisecretary/shared/schemas/invites';
import type { Meta, StoryObj } from '@storybook/react';
import { InviteList } from './invite-list';

const mkInvite = (overrides: Partial<Invite> = {}): Invite => ({
  id: overrides.id ?? '00000000-0000-4000-8000-000000000001',
  email: overrides.email ?? 'pending@acme.test',
  role: overrides.role ?? 'org_member',
  invitedBy: overrides.invitedBy ?? {
    userId: '00000000-0000-4000-8000-000000000099',
    name: 'Admin User',
  },
  expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  acceptedAt: overrides.acceptedAt ?? null,
  revokedAt: overrides.revokedAt ?? null,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
});

const meta: Meta<typeof InviteList> = {
  title: 'Feature/Invites/InviteList',
  component: InviteList,
  parameters: { layout: 'padded' },
  args: { onRevoke: async () => undefined },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof InviteList>;

export const Empty: Story = { args: { invites: [] } };

export const MixedStates: Story = {
  args: {
    invites: [
      mkInvite({ id: 'p1', email: 'pending1@acme.test' }),
      mkInvite({
        id: 'a1',
        email: 'accepted@acme.test',
        acceptedAt: new Date().toISOString(),
      }),
      mkInvite({
        id: 'r1',
        email: 'revoked@acme.test',
        revokedAt: new Date().toISOString(),
      }),
      mkInvite({
        id: 'e1',
        email: 'expired@acme.test',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    ],
  },
};

export const ManyPending: Story = {
  args: {
    invites: Array.from({ length: 6 }, (_, i) =>
      mkInvite({ id: `p-${i}`, email: `pending${i}@acme.test` }),
    ),
  },
};
