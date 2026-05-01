import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

import { EmptyStateRecipient } from './empty-state-recipient';

interface HarnessArgs {
  themeClass?: string;
  withIllustration?: boolean;
  headline?: string;
  subheadline?: string;
}

function Harness({ themeClass, withIllustration, headline, subheadline }: HarnessArgs) {
  const rootRoute = createRootRoute({
    component: () => (
      <div className={themeClass} style={{ padding: '2rem' }}>
        <EmptyStateRecipient
          {...(withIllustration
            ? {
                illustration: (
                  <div
                    aria-hidden="true"
                    style={{
                      width: 256,
                      height: 192,
                      borderRadius: 12,
                      background:
                        'linear-gradient(135deg, var(--accent-soft, #e3e3ff), var(--accent, #3344dd))',
                    }}
                  />
                ),
              }
            : {})}
          {...(headline ? { headline } : {})}
          {...(subheadline ? { subheadline } : {})}
        />
      </div>
    ),
  });
  const stubRoutes = ['/record', '/meetings/$meetingId'].map((p) =>
    createRoute({ getParentRoute: () => rootRoute, path: p, component: () => null }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(stubRoutes),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Feature/Onboarding/EmptyStateRecipient',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Story 1.7 — first-launch home for a brand-new user with zero meetings. Two co-equal paths: sample-meeting library (synthetic content only) + import-existing-audio CTA. Illustrations are designer-brief follow-up; component skeleton works without them.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Harness>;

export const Default: Story = { args: {} };

export const DarkTheme: Story = {
  args: { themeClass: 'theme-dark' },
};

export const WithoutIllustrations: Story = {
  args: { withIllustration: false },
  parameters: {
    docs: {
      description: {
        story:
          'Pre-designer-brief state — component skeleton renders with the sample-library + import-CTA wired and zero illustration slots.',
      },
    },
  },
};

export const WithIllustrationSlot: Story = {
  args: { withIllustration: true },
  parameters: {
    docs: {
      description: {
        story:
          'Illustration slot exercised with a placeholder gradient. Real illustration set lands when the designer brief delivers.',
      },
    },
  },
};

export const CustomCopy: Story = {
  args: {
    headline: 'Welcome back to Acme.',
    subheadline:
      'Your workspace is fresh. Try a sample meeting or drop in an audio file you already have.',
  },
};
