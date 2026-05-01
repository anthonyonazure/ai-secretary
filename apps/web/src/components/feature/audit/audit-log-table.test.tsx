import type { AuditExportRow } from '@aisecretary/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuditLogTable } from './audit-log-table';

const sampleRow: AuditExportRow = {
  id: '11111111-1111-1111-1111-111111111111',
  tenantId: '22222222-2222-2222-2222-222222222222',
  actorUserId: '33333333-3333-3333-3333-333333333333',
  action: 'meeting.created',
  resourceType: 'meeting',
  resourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  metadata: { auto: true },
  requestId: 'req-1',
  region: 'us',
  ipAddress: null,
  userAgent: null,
  createdAt: '2026-04-30T10:00:00.000Z',
};

const defaultFilters = {
  action: '',
  resourceType: '',
  since: '',
  until: '',
};

describe('AuditLogTable', () => {
  it('renders the rows + result count', () => {
    render(
      <AuditLogTable
        items={[sampleRow]}
        totalCount={1}
        filters={defaultFilters}
        onApplyFilters={() => {}}
        onDownloadCsv={() => {}}
      />,
    );
    expect(screen.getByText('1 result')).toBeInTheDocument();
    expect(screen.getByText('meeting.created')).toBeInTheDocument();
    expect(screen.getByTestId(`audit-row-${sampleRow.id}`)).toBeInTheDocument();
  });

  it('shows the empty-state row when there are no items', () => {
    render(
      <AuditLogTable
        items={[]}
        totalCount={0}
        filters={defaultFilters}
        onApplyFilters={() => {}}
        onDownloadCsv={() => {}}
      />,
    );
    expect(screen.getByText('No matching audit entries.')).toBeInTheDocument();
    expect(screen.getByText('0 results')).toBeInTheDocument();
  });

  it('calls onApplyFilters with the form values', async () => {
    const onApplyFilters = vi.fn();
    const user = userEvent.setup();
    render(
      <AuditLogTable
        items={[]}
        totalCount={0}
        filters={defaultFilters}
        onApplyFilters={onApplyFilters}
        onDownloadCsv={() => {}}
      />,
    );
    await user.type(screen.getByTestId('audit-filter-action'), 'meeting.created');
    await user.click(screen.getByTestId('audit-filter-apply'));
    expect(onApplyFilters).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'meeting.created' }),
    );
  });

  it('calls onDownloadCsv when the CSV button is clicked', async () => {
    const onDownloadCsv = vi.fn();
    const user = userEvent.setup();
    render(
      <AuditLogTable
        items={[]}
        totalCount={0}
        filters={defaultFilters}
        onApplyFilters={() => {}}
        onDownloadCsv={onDownloadCsv}
      />,
    );
    await user.click(screen.getByTestId('audit-download-csv'));
    expect(onDownloadCsv).toHaveBeenCalled();
  });

  it('shows "Loading audit log…" when isLoading is true', () => {
    render(
      <AuditLogTable
        items={[]}
        totalCount={0}
        filters={defaultFilters}
        onApplyFilters={() => {}}
        onDownloadCsv={() => {}}
        isLoading
      />,
    );
    expect(screen.getByText('Loading audit log…')).toBeInTheDocument();
  });
});
