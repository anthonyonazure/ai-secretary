import type { Meta, StoryObj } from '@storybook/react';

import { ErasureCascadePreview } from './erasure-cascade-preview';

const meta: Meta<typeof ErasureCascadePreview> = {
  title: 'Feature/Admin/ErasureCascadePreview',
  component: ErasureCascadePreview,
  parameters: {
    docs: {
      description: {
        component:
          'Story 14.4 admin confirmation step. Walks the erasure-cascade registry without mutating, surfaces row counts per table, and exposes Approve / Reject / Escalate-to-legal CTAs. Anti-surveillance: no scoreboard / leaderboard chrome.',
      },
    },
  },
  args: {
    onApprove: () => undefined,
    onReject: () => undefined,
    onEscalate: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof ErasureCascadePreview>;

export const TypicalScope: Story = {
  args: {
    preview: {
      scope: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        userId: '22222222-2222-2222-2222-222222222222',
      },
      totalRowsAffected: 60,
      fullyHandled: true,
      stages: [
        {
          table: 'tenants',
          strategy: 'cascade-source',
          action: 'cascade-source-skipped',
          rowCount: 0,
          note: 'reserved for tenant-level erasure',
        },
        {
          table: 'meetings',
          strategy: 'shred',
          action: 'shred',
          rowCount: 47,
          note: 'cascades audio + transcripts',
        },
        {
          table: 'audit_logs',
          strategy: 'redact',
          action: 'redact',
          rowCount: 13,
          note: 'NULL actor_user_id + ip + ua; preserve trail',
        },
      ],
    },
  },
};

export const NotFullyHandled: Story = {
  args: {
    preview: {
      scope: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        userId: '22222222-2222-2222-2222-222222222222',
      },
      totalRowsAffected: 5,
      fullyHandled: false,
      stages: [
        {
          table: 'meetings',
          strategy: 'shred',
          action: 'shred',
          rowCount: 5,
        },
        {
          table: 'mystery_table',
          strategy: 'shred',
          action: 'noop-out-of-scope',
          rowCount: 0,
          note: 'no counter registered — escalate to engineering',
        },
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'When some tables in the cascade map lack counters, the preview surfaces a warning to escalate.',
      },
    },
  },
};

export const Pending: Story = {
  args: {
    preview: {
      scope: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        userId: '22222222-2222-2222-2222-222222222222',
      },
      totalRowsAffected: 10,
      fullyHandled: true,
      stages: [{ table: 'meetings', strategy: 'shred', action: 'shred', rowCount: 10 }],
    },
    isPending: true,
  },
};
