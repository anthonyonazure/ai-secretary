import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyStateRecipient } from './empty-state-recipient';

/**
 * The Sample Library + Import CTA both consume `<Link>` from
 * @tanstack/react-router. Tests need a router context — we mount a
 * minimal in-memory router with the routes the empty-state surface
 * resolves to (`/meetings/$meetingId` + `/record`).
 */
const mountWithRouter = (ui: React.ReactNode) => {
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
  const recordRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/record',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, meetingRoute, recordRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

describe('EmptyStateRecipient', () => {
  it('renders the sample library + import CTA without illustrations', async () => {
    mountWithRouter(<EmptyStateRecipient />);
    expect(await screen.findByTestId('empty-state-recipient')).toBeInTheDocument();
    expect(screen.getByTestId('sample-library')).toBeInTheDocument();
    expect(screen.getByTestId('import-cta')).toBeInTheDocument();
    // Three sample cards.
    expect(screen.getByTestId('sample-card-sample-sales-call')).toBeInTheDocument();
    expect(screen.getByTestId('sample-card-sample-one-on-one')).toBeInTheDocument();
    expect(screen.getByTestId('sample-card-sample-standup')).toBeInTheDocument();
    // No illustration slot is rendered when the prop is omitted.
    expect(screen.queryByTestId('empty-state-illustration')).not.toBeInTheDocument();
  });

  it('renders an illustration slot when the prop is provided', async () => {
    mountWithRouter(
      <EmptyStateRecipient illustration={<svg data-testid="custom-illustration" />} />,
    );
    expect(await screen.findByTestId('empty-state-illustration')).toBeInTheDocument();
    expect(screen.getByTestId('custom-illustration')).toBeInTheDocument();
  });

  it('honors override headline + subheadline', async () => {
    mountWithRouter(<EmptyStateRecipient headline="Custom hello" subheadline="Custom subtitle" />);
    expect(await screen.findByText('Custom hello')).toBeInTheDocument();
    expect(screen.getByText('Custom subtitle')).toBeInTheDocument();
  });
});
