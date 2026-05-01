import type { Meta, StoryObj } from '@storybook/react';

import { type InAppNotification, NotificationBell } from './notification-bell';

const meta: Meta<typeof NotificationBell> = {
  title: 'Feature/Notifications/NotificationBell',
  component: NotificationBell,
  parameters: {
    docs: {
      description: {
        component:
          'Header-bar bell with unread badge + dropdown. Per UX spec § Step 5 #4: notifications are dismissible per-item; "Mark all read" lives in the footer for users who want it but isn\'t the default action.',
      },
    },
  },
  args: {
    onSelect: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof NotificationBell>;

const sampleItems: InAppNotification[] = [
  {
    id: 'n1',
    kind: 'transcript-ready',
    title: 'Transcript ready',
    body: 'Quarterly review · 32 min',
    createdAt: '2026-04-30T10:15:00Z',
    unread: true,
  },
  {
    id: 'n2',
    kind: 'analysis-completed',
    title: 'Sales analysis complete',
    body: 'Identified 3 objections + 2 next-steps.',
    createdAt: '2026-04-30T08:00:00Z',
    unread: true,
  },
  {
    id: 'n3',
    kind: 'share-received',
    title: 'Share received',
    body: 'Casey Lee shared a meeting receipt with you.',
    createdAt: '2026-04-29T14:00:00Z',
    unread: false,
  },
];

export const NoUnread: Story = {
  args: {
    notifications: sampleItems.map((n) => ({ ...n, unread: false })),
  },
};

export const TwoUnread: Story = {
  args: { notifications: sampleItems },
};

export const OverNine: Story = {
  args: {
    notifications: Array.from({ length: 12 }, (_, i) => ({
      id: `n${i}`,
      kind: 'transcript-ready' as const,
      title: `Transcript #${i + 1}`,
      body: 'A meeting is ready.',
      createdAt: '2026-04-30T10:00:00Z',
      unread: true,
    })),
  },
  parameters: {
    docs: {
      description: { story: 'Badge caps at 9+ — no double-digit number visible in the chrome.' },
    },
  },
};

export const Empty: Story = {
  args: { notifications: [] },
};
