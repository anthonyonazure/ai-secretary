import type { ErasurePreviewResponse } from '@aisecretary/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErasureCascadePreview } from './erasure-cascade-preview';

const samplePreview: ErasurePreviewResponse = {
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
    },
  ],
};

describe('ErasureCascadePreview', () => {
  it('renders the row-count summary line', () => {
    render(
      <ErasureCascadePreview
        preview={samplePreview}
        onApprove={() => {}}
        onReject={() => {}}
        onEscalate={() => {}}
      />,
    );
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByTestId('erasure-preview-summary').textContent).toMatch(/2 tables/);
  });

  it('renders one row per visible (non-noop) stage', () => {
    render(
      <ErasureCascadePreview
        preview={samplePreview}
        onApprove={() => {}}
        onReject={() => {}}
        onEscalate={() => {}}
      />,
    );
    expect(screen.getByTestId('erasure-stage-meetings')).toBeInTheDocument();
    expect(screen.getByTestId('erasure-stage-audit_logs')).toBeInTheDocument();
    // Skipped tenant row goes into the collapsible "intentionally untouched" details.
    expect(screen.queryByTestId('erasure-stage-tenants')).not.toBeInTheDocument();
  });

  it('shows the not-fully-handled warning when fullyHandled=false', () => {
    render(
      <ErasureCascadePreview
        preview={{ ...samplePreview, fullyHandled: false }}
        onApprove={() => {}}
        onReject={() => {}}
        onEscalate={() => {}}
      />,
    );
    expect(screen.getByTestId('erasure-not-fully-handled')).toBeInTheDocument();
  });

  it('wires Approve / Reject / Escalate callbacks', async () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onEscalate = vi.fn();
    const user = userEvent.setup();
    render(
      <ErasureCascadePreview
        preview={samplePreview}
        onApprove={onApprove}
        onReject={onReject}
        onEscalate={onEscalate}
      />,
    );
    await user.click(screen.getByTestId('erasure-approve'));
    await user.click(screen.getByTestId('erasure-reject'));
    await user.click(screen.getByTestId('erasure-escalate'));
    expect(onApprove).toHaveBeenCalled();
    expect(onReject).toHaveBeenCalled();
    expect(onEscalate).toHaveBeenCalled();
  });

  it('disables the approve button while pending', () => {
    render(
      <ErasureCascadePreview
        preview={samplePreview}
        onApprove={() => {}}
        onReject={() => {}}
        onEscalate={() => {}}
        isPending
      />,
    );
    const approve = screen.getByTestId('erasure-approve') as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(approve.textContent).toBe('Queuing…');
  });
});
