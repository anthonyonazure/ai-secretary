import type { Meta, StoryObj } from '@storybook/react';

import { DsarQueue, type DsarQueueRow } from './dsar-queue';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const meta: Meta<typeof DsarQueue> = {
  title: 'Feature/Admin/DsarQueue',
  component: DsarQueue,
  parameters: {
    docs: {
      description: {
        component:
          'Story 14.x admin queue for DSAR + erasure requests. Three sources (in-tenant, public-portal, bulk) and three actions (approve, reject, escalate to legal). The 30-day statute deadline is shown on every row in danger color when overdue.',
      },
    },
  },
  args: {
    onPreview: () => undefined,
    onApprove: () => undefined,
    onReject: () => undefined,
    onEscalate: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof DsarQueue>;

const sampleRow = (overrides: Partial<DsarQueueRow> = {}): DsarQueueRow => ({
  id: 'r1',
  source: 'in-tenant',
  kind: 'access',
  submitter: 'subject@example.com',
  createdAt: '2026-04-15T10:00:00Z',
  dueBy: new Date(Date.now() + 7 * ONE_DAY_MS).toISOString(),
  status: 'pending',
  ...overrides,
});

export const Empty: Story = { args: { rows: [] } };

export const TypicalQueue: Story = {
  args: {
    rows: [
      sampleRow({
        id: 'r-portal',
        source: 'public-portal',
        kind: 'deletion',
        submitter: 'former-customer@example.com',
        previewSummary: '47 transcripts, 12 summaries, 1,200 embeddings',
      }),
      sampleRow({
        id: 'r-internal',
        source: 'in-tenant',
        kind: 'access',
        submitter: 'casey@acme.example',
        status: 'preview-ready',
      }),
      sampleRow({
        id: 'r-bulk',
        source: 'bulk',
        kind: 'deletion',
        submitter: 'admin-initiated',
        previewSummary: 'Bulk: 8 users, 312 meetings',
      }),
    ],
  },
};

export const Overdue: Story = {
  args: {
    rows: [
      sampleRow({
        id: 'r-overdue',
        source: 'public-portal',
        kind: 'deletion',
        dueBy: new Date(Date.now() - 3 * ONE_DAY_MS).toISOString(),
        previewSummary: 'Statute deadline missed — escalate',
      }),
    ],
  },
};

export const MixedStates: Story = {
  args: {
    rows: [
      sampleRow({ id: 'r-a', status: 'pending' }),
      sampleRow({ id: 'r-b', status: 'queued' }),
      sampleRow({ id: 'r-c', status: 'completed' }),
      sampleRow({ id: 'r-d', status: 'rejected' }),
      sampleRow({ id: 'r-e', status: 'escalated' }),
    ],
  },
};
