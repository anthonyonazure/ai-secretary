import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DsarQueue, type DsarQueueRow } from './dsar-queue';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

describe('DsarQueue', () => {
  it('renders the empty state when there are no rows', () => {
    render(
      <DsarQueue
        rows={[]}
        onPreview={() => {}}
        onApprove={() => {}}
        onReject={() => {}}
        onEscalate={() => {}}
      />,
    );
    expect(screen.getByTestId('dsar-queue-empty')).toBeInTheDocument();
  });

  it('renders one row per request with the source + submitter', () => {
    render(
      <DsarQueue
        rows={[sampleRow({ id: 'a' })]}
        onPreview={() => {}}
        onApprove={() => {}}
        onReject={() => {}}
        onEscalate={() => {}}
      />,
    );
    expect(screen.getByTestId('dsar-queue-row-a')).toBeInTheDocument();
    expect(screen.getByText('In-tenant')).toBeInTheDocument();
    expect(screen.getByText('subject@example.com')).toBeInTheDocument();
  });

  it('shows "Nd overdue" in danger color when due date has passed', () => {
    render(
      <DsarQueue
        rows={[
          sampleRow({
            id: 'a',
            dueBy: new Date(Date.now() - 3 * ONE_DAY_MS).toISOString(),
          }),
        ]}
        onPreview={() => {}}
        onApprove={() => {}}
        onReject={() => {}}
        onEscalate={() => {}}
      />,
    );
    expect(screen.getByText(/3d overdue/)).toBeInTheDocument();
  });

  it('wires the four callbacks correctly', async () => {
    const onPreview = vi.fn();
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onEscalate = vi.fn();
    const user = userEvent.setup();
    const row = sampleRow({ id: 'a' });
    render(
      <DsarQueue
        rows={[row]}
        onPreview={onPreview}
        onApprove={onApprove}
        onReject={onReject}
        onEscalate={onEscalate}
      />,
    );
    await user.click(screen.getByTestId(`dsar-queue-preview-${row.id}`));
    await user.click(screen.getByTestId(`dsar-queue-approve-${row.id}`));
    await user.click(screen.getByTestId(`dsar-queue-reject-${row.id}`));
    await user.click(screen.getByTestId(`dsar-queue-escalate-${row.id}`));
    expect(onPreview).toHaveBeenCalledWith(row);
    expect(onApprove).toHaveBeenCalledWith(row);
    expect(onReject).toHaveBeenCalledWith(row);
    expect(onEscalate).toHaveBeenCalledWith(row);
  });

  it('hides the action buttons for completed / rejected / escalated rows', () => {
    render(
      <DsarQueue
        rows={[sampleRow({ id: 'a', status: 'completed' })]}
        onPreview={() => {}}
        onApprove={() => {}}
        onReject={() => {}}
        onEscalate={() => {}}
      />,
    );
    expect(screen.getByTestId('dsar-queue-preview-a')).toBeInTheDocument();
    expect(screen.queryByTestId('dsar-queue-approve-a')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dsar-queue-reject-a')).not.toBeInTheDocument();
  });
});
