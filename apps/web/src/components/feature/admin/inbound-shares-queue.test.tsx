import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { type InboundShareRow, InboundSharesQueue } from './inbound-shares-queue';

const sampleRow: InboundShareRow = {
  id: 'inbound-1',
  sourceTenantDomain: 'partner.example',
  sourceUserEmail: 'alex@partner.example',
  recipientEmail: 'sam@acme.example',
  resourceLabel: 'Quarterly review',
  kind: 'meeting',
  status: 'pending',
  createdAt: '2026-04-29T10:00:00Z',
  expiresAt: '2026-05-29T10:00:00Z',
};

describe('InboundSharesQueue', () => {
  it('renders the empty-state when there are no rows', () => {
    render(<InboundSharesQueue rows={[]} onView={() => {}} onBlockDomain={() => {}} />);
    expect(screen.getByTestId('inbound-shares-empty')).toBeInTheDocument();
  });

  it('renders each row with sender + recipient + resource', () => {
    render(<InboundSharesQueue rows={[sampleRow]} onView={() => {}} onBlockDomain={() => {}} />);
    expect(screen.getByTestId(`inbound-share-${sampleRow.id}`)).toBeInTheDocument();
    expect(screen.getByText('Quarterly review')).toBeInTheDocument();
    expect(screen.getByText('alex@partner.example')).toBeInTheDocument();
  });

  it('calls onView when the View button is clicked', async () => {
    const onView = vi.fn();
    const user = userEvent.setup();
    render(<InboundSharesQueue rows={[sampleRow]} onView={onView} onBlockDomain={() => {}} />);
    await user.click(screen.getByTestId(`inbound-share-view-${sampleRow.id}`));
    expect(onView).toHaveBeenCalledWith(sampleRow);
  });

  it('calls onBlockDomain with the source tenant domain', async () => {
    const onBlockDomain = vi.fn();
    const user = userEvent.setup();
    render(
      <InboundSharesQueue rows={[sampleRow]} onView={() => {}} onBlockDomain={onBlockDomain} />,
    );
    await user.click(screen.getByTestId(`inbound-share-block-${sampleRow.id}`));
    expect(onBlockDomain).toHaveBeenCalledWith('partner.example');
  });

  it('shows the right badge per status', () => {
    const rows: InboundShareRow[] = [
      { ...sampleRow, id: 'r1', status: 'accepted' },
      { ...sampleRow, id: 'r2', status: 'blocked-by-policy' },
      { ...sampleRow, id: 'r3', status: 'expired' },
    ];
    render(<InboundSharesQueue rows={rows} onView={() => {}} onBlockDomain={() => {}} />);
    expect(screen.getByText('Viewed')).toBeInTheDocument();
    expect(screen.getByText('Blocked by policy')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });
});
