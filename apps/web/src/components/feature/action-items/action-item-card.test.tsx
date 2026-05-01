import type { ActionItemRow } from '@aisecretary/shared';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ActionItemCard } from './action-item-card';

const sampleItem: ActionItemRow = {
  id: '11111111-1111-1111-1111-111111111111',
  meetingId: '22222222-2222-2222-2222-222222222222',
  meetingTitle: 'Weekly sales sync',
  meetingRecordedAt: '2026-04-29T15:00:00.000Z',
  text: 'Send the SOC 2 questionnaire to Acme.',
  ownerName: 'Anthony',
  ownerUserId: null,
  dueDate: '2026-05-05T00:00:00.000Z',
  status: 'pending',
  confidence: 0.85,
  citations: [],
  createdAt: '2026-04-29T15:30:00.000Z',
  updatedAt: '2026-04-29T15:30:00.000Z',
};

const renderWithRouter = (ui: React.ReactNode) => {
  const rootRoute = createRootRoute({ component: () => <>{ui}</> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  });
  const meetingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/meetings/$meetingId',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, meetingRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return render(<RouterProvider router={router} />);
};

describe('ActionItemCard', () => {
  it('renders text + owner + due date + meeting backlink', async () => {
    const onUpdate = vi.fn();
    renderWithRouter(
      <ActionItemCard item={sampleItem} isPending={false} onUpdateStatus={onUpdate} />,
    );
    expect(await screen.findByText('Send the SOC 2 questionnaire to Acme.')).toBeInTheDocument();
    expect(screen.getByText('Anthony')).toBeInTheDocument();
    expect(screen.getByText('Weekly sales sync')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('calls onUpdateStatus("done") when the mark-done button is clicked', async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    renderWithRouter(
      <ActionItemCard item={sampleItem} isPending={false} onUpdateStatus={onUpdate} />,
    );
    const button = await screen.findByTestId('mark-done');
    await user.click(button);
    expect(onUpdate).toHaveBeenCalledWith(sampleItem.id, 'done');
  });

  it('calls onUpdateStatus("dismissed") when the dismiss button is clicked', async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    renderWithRouter(
      <ActionItemCard item={sampleItem} isPending={false} onUpdateStatus={onUpdate} />,
    );
    const button = await screen.findByTestId('dismiss');
    await user.click(button);
    expect(onUpdate).toHaveBeenCalledWith(sampleItem.id, 'dismissed');
  });

  it('hides action buttons when the item is closed (done)', async () => {
    const onUpdate = vi.fn();
    renderWithRouter(
      <ActionItemCard
        item={{ ...sampleItem, status: 'done' }}
        isPending={false}
        onUpdateStatus={onUpdate}
      />,
    );
    // Wait for the card itself to render before asserting absence.
    expect(await screen.findByTestId('action-item-card')).toBeInTheDocument();
    expect(screen.queryByTestId('mark-done')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dismiss')).not.toBeInTheDocument();
  });

  it('disables action buttons while a mutation is pending', async () => {
    const onUpdate = vi.fn();
    renderWithRouter(
      <ActionItemCard item={sampleItem} isPending={true} onUpdateStatus={onUpdate} />,
    );
    expect(await screen.findByTestId('mark-done')).toBeDisabled();
    expect(screen.getByTestId('dismiss')).toBeDisabled();
  });
});
