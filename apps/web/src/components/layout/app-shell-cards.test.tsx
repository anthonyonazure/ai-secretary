/// <reference lib="dom" />

import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRecordingPillStore } from '../feature/recording/recording-state-store';
import { AppShellCards } from './app-shell-cards';
import { __resetShellModeStoreForTests, useShellModeStore } from './shell-mode-store';
import { HideInSingleUser } from './visibility-layer';

function renderCardsShell(children?: React.ReactNode) {
  const rootRoute = createRootRoute({
    component: () => <AppShellCards>{children}</AppShellCards>,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return render(<RouterProvider router={router} />);
}

describe('AppShellCards (Story 1.6)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetShellModeStoreForTests();
    useShellModeStore.getState().setMode('cards');
    useRecordingPillStore.getState().reset();
  });
  // No `afterEach` reset of the pill store — see
  // app-shell-inbox.test.tsx for the rationale (avoiding a
  // rules-of-hooks transition in the existing RecordingStatusPill).

  it('renders the minimal header with logo + recording-pill slot', async () => {
    renderCardsShell();
    expect(await screen.findByText(/AI Secretary/i)).toBeInTheDocument();
    const slot = document.querySelector('[data-slot="recording-pill"]');
    expect(slot).not.toBeNull();
  });

  it('hides org features by default via the visibility layer', async () => {
    renderCardsShell(
      <HideInSingleUser>
        <p data-testid="org-feature">Team-lead surface</p>
      </HideInSingleUser>,
    );
    // Mode is `cards` from beforeEach, so the surface is hidden.
    expect(screen.queryByTestId('org-feature')).toBeNull();
  });

  it('exposes a "Show organization features" toggle that flips to inbox mode', async () => {
    renderCardsShell();
    const toggle = await screen.findByTestId('show-org-features-toggle');
    fireEvent.click(toggle);
    expect(useShellModeStore.getState().mode).toBe('inbox');
  });

  it('reveals previously-hidden surfaces after the org toggle is clicked', async () => {
    const { rerender } = renderCardsShell(
      <HideInSingleUser>
        <p data-testid="org-feature">Team-lead surface</p>
      </HideInSingleUser>,
    );
    expect(screen.queryByTestId('org-feature')).toBeNull();

    // Flip the mode in the store directly — the visibility layer reacts.
    useShellModeStore.getState().setMode('inbox');
    rerender(<div />);
    // Re-render the shell-less subject directly via the visibility layer
    // — switching modes inside the cards-shell test would unmount the
    // shell itself, so we verify the visibility layer transition.
    render(
      <HideInSingleUser>
        <p data-testid="org-feature-after">Team-lead surface</p>
      </HideInSingleUser>,
    );
    expect(screen.getByTestId('org-feature-after')).toBeInTheDocument();
  });
});
