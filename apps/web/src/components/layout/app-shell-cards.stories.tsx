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
import { AppShellCards } from './app-shell-cards';
import { useShellModeStore } from './shell-mode-store';
import { HideInSingleUser } from './visibility-layer';

/**
 * `AppShell.Cards` — D3 single-user mode — Storybook harness.
 *
 * Calmer chrome appropriate for solo users (UX spec § Navigation
 * patterns). The "Show organization features" button in the header
 * flips back to inbox mode; stories below mount the harness with the
 * shell-mode store pre-set to `cards` so the visibility layer hides
 * org-only surfaces.
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
  useEffect(() => {
    useShellModeStore.getState().setMode('cards');
    useRecordingPillStore.getState().set({ state: pillState, elapsedSeconds });
    return () => {
      useRecordingPillStore.getState().reset();
      useShellModeStore.getState().setMode('inbox');
    };
  }, [pillState, elapsedSeconds]);

  const rootRoute = createRootRoute({
    component: () => (
      <div className={themeClass}>
        <AppShellCards>
          <section className="flex flex-col gap-4">
            <h1 className="font-sans text-2xl font-semibold">My meetings</h1>
            <p className="text-sm text-fg-muted">
              Single-column card feed. Org-only surfaces are hidden via the visibility layer.
            </p>
            <HideInSingleUser>
              <p data-testid="org-feature" className="rounded-md bg-warning/20 p-3 text-sm">
                Org-only feature (you should NOT see this in cards mode).
              </p>
            </HideInSingleUser>
          </section>
        </AppShellCards>
      </div>
    ),
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
  return <RouterProvider router={router} />;
}

const meta: Meta<typeof ShellHarness> = {
  title: 'Layout/AppShell.Cards',
  component: ShellHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'D3 single-user shell — minimal header (logo + cmd-K + recording pill + show-org toggle). Visibility layer hides team-lead / admin / embed surfaces by default.',
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
