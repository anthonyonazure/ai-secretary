import type { Meta, StoryObj } from '@storybook/react';

import type { AuditExportRow } from '@aisecretary/shared';

import { AuditLogTable } from './audit-log-table';

const meta: Meta<typeof AuditLogTable> = {
  title: 'Feature/Audit/AuditLogTable',
  component: AuditLogTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Story 12.5 audit-log viewer. Module-tinted left-border per resource type; CSV export wires to GET /api/v1/audit-export. aria-live="polite" on the result-count line; native role=table semantics elsewhere.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AuditLogTable>;

const baseFilters = {
  action: '',
  resourceType: '',
  since: '',
  until: '',
};

const sampleRow = (overrides: Partial<AuditExportRow>): AuditExportRow => ({
  id: '00000000-0000-0000-0000-000000000001',
  tenantId: '00000000-0000-0000-0000-0000000000aa',
  createdAt: '2026-04-30T11:42:00.000Z',
  action: 'meeting.created',
  resourceType: 'meeting',
  resourceId: '00000000-0000-0000-0000-000000000abc',
  actorUserId: '00000000-0000-0000-0000-000000000def',
  region: 'us',
  metadata: {},
  requestId: null,
  ipAddress: null,
  userAgent: null,
  ...overrides,
});

const sampleRows: AuditExportRow[] = [
  sampleRow({ id: 'r-1', action: 'meeting.created', resourceType: 'meeting' }),
  sampleRow({
    id: 'r-2',
    action: 'share.created',
    resourceType: 'share',
    createdAt: '2026-04-30T11:40:00.000Z',
  }),
  sampleRow({
    id: 'r-3',
    action: 'recording.started',
    resourceType: 'recording',
    createdAt: '2026-04-30T11:38:00.000Z',
  }),
  sampleRow({
    id: 'r-4',
    action: 'consent.acknowledged',
    resourceType: 'consent',
    createdAt: '2026-04-30T11:36:00.000Z',
  }),
  sampleRow({
    id: 'r-5',
    action: 'dsar.requested',
    resourceType: 'dsar',
    createdAt: '2026-04-30T11:34:00.000Z',
  }),
];

const noop = () => {};

export const Default: Story = {
  args: {
    items: sampleRows,
    totalCount: sampleRows.length,
    rangeLabel: 'last 30 days',
    filters: baseFilters,
    onApplyFilters: noop,
    onDownloadCsv: noop,
  },
};

export const Empty: Story = {
  args: {
    items: [],
    totalCount: 0,
    rangeLabel: 'last 30 days',
    filters: baseFilters,
    onApplyFilters: noop,
    onDownloadCsv: noop,
  },
};

export const Loading: Story = {
  args: {
    items: [],
    totalCount: 0,
    rangeLabel: 'last 30 days',
    filters: baseFilters,
    onApplyFilters: noop,
    onDownloadCsv: noop,
    isLoading: true,
  },
};

export const FilteredToShares: Story = {
  args: {
    items: sampleRows.filter((r) => r.resourceType === 'share'),
    totalCount: 1,
    rangeLabel: 'last 7 days',
    filters: { ...baseFilters, resourceType: 'share' },
    onApplyFilters: noop,
    onDownloadCsv: noop,
  },
};

export const SingularResultCount: Story = {
  args: {
    items: [sampleRows[0] as AuditExportRow],
    totalCount: 1,
    rangeLabel: 'today',
    filters: baseFilters,
    onApplyFilters: noop,
    onDownloadCsv: noop,
  },
};
