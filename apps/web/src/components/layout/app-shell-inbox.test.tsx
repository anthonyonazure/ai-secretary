/// <reference lib="dom" />

import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRecordingPillStore } from '../feature/recording/recording-state-store';
import { AppShellInbox } from './app-shell-inbox';

function renderShellInRouter() {
  // Build a minimal in-memory router so `<Link>` resolves without
  // needing the full file-route tree from `routeTree.gen.ts`.
  const rootRoute = createRootRoute({
    component: () => <AppShellInbox>{null}</AppShellInbox>,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  });
  // Add stub child routes so the sidebar `<Link>`s have valid targets.
  const inboxRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/inbox',
    component: () => null,
  });
  const recordRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/record',
    component: () => null,
  });
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: () => null,
  });
  const todayRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/today',
    component: () => null,
  });
  const searchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/search',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      inboxRoute,
      recordRoute,
      settingsRoute,
      todayRoute,
      searchRoute,
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return render(<RouterProvider router={router} />);
}

describe('AppShellInbox (Story 1.6)', () => {
  beforeEach(() => {
    useRecordingPillStore.getState().reset();
  });
  // Note: we deliberately don't reset the recording-store in
  // `afterEach`. The setup `cleanup()` already unmounts the tree, and
  // resetting *before* cleanup transitions the pill from `recording`
  // to `idle` while still mounted, which triggers a known
  // rules-of-hooks edge case in the existing `RecordingStatusPill`
  // (early return after a single hook call). The store reset in
  // `beforeEach` of the *next* test handles cross-test isolation.

  it('renders the sidebar with primary nav links', async () => {
    renderShellInRouter();
    // Exact "Sidebar" label — distinguishes from the toggle button's
    // "Open sidebar" / "Close sidebar" aria-label.
    expect(await screen.findByLabelText('Sidebar')).toBeInTheDocument();
    expect(await screen.findByRole('navigation', { name: /primary/i })).toBeInTheDocument();
  });

  it('exposes a recording-pill slot top-right of the header', async () => {
    renderShellInRouter();
    await waitFor(() => {
      expect(document.querySelector('[data-slot="recording-pill"]')).not.toBeNull();
    });
  });

  it('renders the pill when the recording store is in recording state', async () => {
    useRecordingPillStore.getState().set({
      state: 'recording',
      elapsedSeconds: 65,
      device: { name: 'Built-in Microphone', type: 'builtin' },
    });
    renderShellInRouter();
    // ariaSeconds rounds DOWN to the nearest 30s for screen-reader
    // calmness — 65 → 60s → "1 minute".
    expect(await screen.findByLabelText(/Recording, 1 minute/)).toBeInTheDocument();
  });

  it('hides the pill when state is idle (slot stays mounted)', async () => {
    renderShellInRouter();
    await waitFor(() => {
      const slot = document.querySelector('[data-slot="recording-pill"]');
      expect(slot).not.toBeNull();
      // Slot is in DOM but its child (the pill) renders nothing when idle.
      expect(slot?.querySelector('[data-state="recording"]')).toBeNull();
    });
  });

  it('mounts a skip-to-main-content link for keyboard users', async () => {
    renderShellInRouter();
    expect(await screen.findByText(/skip to main content/i)).toBeInTheDocument();
  });
});
