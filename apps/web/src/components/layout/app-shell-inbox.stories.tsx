import type { Meta, StoryObj } from '@storybook/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { useEffect } from 'react';
import { useRecordingPillStore } from '../feature/recording/recording-state-store';
import { AppShellInbox } from './app-shell-inbox';

/**
 * `AppShell.Inbox` — D1 default — Storybook harness.
 *
 * The shell expects a TanStack Router context (it uses `<Link>` for
 * sidebar nav and `<Outlet />` for content), so each story builds a
 * minimal in-memory router with the inbox shell at the root and stub
 * routes for every nav target.
 */
function ShellHarness({
  pillState = 'idle',
  elapsedSeconds = 0,
  themeClass,
}: {
  pillState?: 'idle' | 'recording' | 'paused';
  elapsedSeconds?: number;
  themeClass?: string;
}) {
  // Drive the shared pill store so the shell's slot reflects the
  // current state. Reset on unmount so stories don't leak.
  useEffect(() => {
    useRecordingPillStore.getState().set({ state: pillState, elapsedSeconds });
    return () => useRecordingPillStore.getState().reset();
  }, [pillState, elapsedSeconds]);

  const rootRoute = createRootRoute({
    component: () => (
      <div className={themeClass}>
        <AppShellInbox>
          <section className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
            <h1 className="font-sans text-2xl font-semibold">Inbox</h1>
            <p className="text-sm text-fg-muted">
              Placeholder content. Real meeting list lands in Epic 4.
            </p>
          </section>
        </AppShellInbox>
      </div>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  });
  const stubRoutes = ['/inbox', '/record', '/settings', '/today', '/search'].map((p) =>
    createRoute({ getParentRoute: () => rootRoute, path: p, component: () => null }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, ...stubRoutes]),
    history: createMemoryHistory({ initialEntries: ['/inbox'] }),
  });
  return <RouterProvider router={router} />;
}

const meta: Meta<typeof ShellHarness> = {
  title: 'Layout/AppShell.Inbox',
  component: ShellHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'D1 default shell — sidebar + cmd-K + content pane. RecordingStatusPill slot is top-right of the header per UX spec U1. Stories below exercise idle / recording / dark-theme / accessible-density combinations.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ShellHarness>;

export const Empty: Story = {
  args: { pillState: 'idle' },
};

export const WithRecordingActive: Story = {
  args: { pillState: 'recording', elapsedSeconds: 154 },
};

export const DarkTheme: Story = {
  args: { pillState: 'idle', themeClass: 'theme-dark bg-bg' },
};

export const AccessibleDensity: Story = {
  args: { pillState: 'idle', themeClass: 'density-accessible' },
};
