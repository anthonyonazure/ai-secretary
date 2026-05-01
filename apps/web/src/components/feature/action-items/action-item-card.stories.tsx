import type { Meta, StoryObj } from '@storybook/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

import { ActionItemCard } from './action-item-card';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const meta: Meta<typeof ActionItemCard> = {
  title: 'Feature/ActionItems/ActionItemCard',
  component: ActionItemCard,
  decorators: [
    (Story) => {
      const rootRoute = createRootRoute({ component: () => <Story /> });
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
      return <RouterProvider router={router} />;
    },
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Story 8.5 My Actions card — single action item with the source-meeting backlink, owner + due date, and one-tap mark-done. Status FSM: pending / accepted / done / dismissed. Closed items hide the action buttons.',
      },
    },
  },
  args: {
    onUpdateStatus: () => undefined,
    isPending: false,
  },
};
export default meta;

type Story = StoryObj<typeof ActionItemCard>;

const baseItem = {
  id: '11111111-1111-1111-1111-111111111111',
  meetingId: '22222222-2222-2222-2222-222222222222',
  meetingTitle: 'Quarterly review',
  meetingRecordedAt: '2026-04-29T15:00:00.000Z',
  text: 'Send the SOC 2 questionnaire to Acme.',
  ownerName: 'Anthony',
  ownerUserId: null,
  confidence: 0.85,
  citations: [],
  createdAt: '2026-04-29T15:30:00.000Z',
  updatedAt: '2026-04-29T15:30:00.000Z',
};

export const Pending: Story = {
  args: {
    item: {
      ...baseItem,
      status: 'pending',
      dueDate: new Date(Date.now() + 5 * ONE_DAY_MS).toISOString(),
    },
  },
};

export const Done: Story = {
  args: {
    item: {
      ...baseItem,
      status: 'done',
      dueDate: null,
    },
  },
};

export const NoDueDate: Story = {
  args: {
    item: {
      ...baseItem,
      status: 'pending',
      dueDate: null,
    },
  },
};

export const Pending100PendingMutation: Story = {
  name: 'Pending — mutation inflight',
  args: {
    item: { ...baseItem, status: 'pending', dueDate: null },
    isPending: true,
  },
};
