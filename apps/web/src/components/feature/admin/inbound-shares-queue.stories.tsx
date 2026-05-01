import type { Meta, StoryObj } from '@storybook/react';

import { type InboundShareRow, InboundSharesQueue } from './inbound-shares-queue';

const meta: Meta<typeof InboundSharesQueue> = {
  title: 'Feature/Admin/InboundSharesQueue',
  component: InboundSharesQueue,
  parameters: {
    docs: {
      description: {
        component:
          'Story 8.4 admin queue — receiving-tenant view of cross-org shares. Five status badges (pending / viewed / blocked-by-policy / expired / revoked); per-row "Block sender domain" CTA escalates to the cross-org policy form.',
      },
    },
  },
  args: {
    onView: () => undefined,
    onBlockDomain: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof InboundSharesQueue>;

const baseRow: InboundShareRow = {
  id: 'inb-1',
  sourceTenantDomain: 'partner.example',
  sourceUserEmail: 'alex@partner.example',
  recipientEmail: 'sam@acme.example',
  resourceLabel: 'Quarterly review',
  kind: 'meeting',
  status: 'pending',
  createdAt: '2026-04-29T10:00:00Z',
  expiresAt: '2026-05-29T10:00:00Z',
};

export const Empty: Story = { args: { rows: [] } };

export const SingleRow: Story = { args: { rows: [baseRow] } };

export const StatusGallery: Story = {
  args: {
    rows: [
      { ...baseRow, id: 'a', status: 'pending' },
      { ...baseRow, id: 'b', status: 'accepted' },
      { ...baseRow, id: 'c', status: 'blocked-by-policy' },
      { ...baseRow, id: 'd', status: 'expired' },
      { ...baseRow, id: 'e', status: 'revoked' },
    ],
  },
};

export const Loading: Story = { args: { rows: [], isLoading: true } };
