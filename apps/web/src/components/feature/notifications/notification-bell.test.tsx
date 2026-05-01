import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { type InAppNotification, NotificationBell } from './notification-bell';

const sample = (overrides: Partial<InAppNotification> = {}): InAppNotification => ({
  id: 'n1',
  kind: 'transcript-ready',
  title: 'Your transcript is ready',
  body: 'Quarterly review · 32 min',
  createdAt: '2026-04-30T10:00:00Z',
  unread: true,
  ...overrides,
});

describe('NotificationBell', () => {
  it('shows an unread badge with the count', () => {
    render(
      <NotificationBell
        notifications={[
          sample({ id: 'a' }),
          sample({ id: 'b' }),
          sample({ id: 'c', unread: false }),
        ]}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId('notification-bell-unread-badge').textContent).toBe('2');
    expect(screen.getByTestId('notification-bell').getAttribute('aria-label')).toMatch(/2 unread/);
  });

  it('caps the badge display at 9+', () => {
    const items = Array.from({ length: 12 }, (_, i) => sample({ id: `n${i}` }));
    render(<NotificationBell notifications={items} onSelect={() => {}} />);
    expect(screen.getByTestId('notification-bell-unread-badge').textContent).toBe('9+');
  });

  it('opens the dropdown on click and lists items', async () => {
    const user = userEvent.setup();
    render(<NotificationBell notifications={[sample({ id: 'a' })]} onSelect={() => {}} />);
    await user.click(screen.getByTestId('notification-bell'));
    expect(screen.getByTestId('notification-bell-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('notification-bell-item-a')).toBeInTheDocument();
  });

  it('calls onSelect when an item is clicked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const item = sample({ id: 'a' });
    render(<NotificationBell notifications={[item]} onSelect={onSelect} />);
    await user.click(screen.getByTestId('notification-bell'));
    await user.click(screen.getByTestId('notification-bell-item-a'));
    expect(onSelect).toHaveBeenCalledWith(item);
  });

  it('renders the empty-state copy when nothing is queued', async () => {
    const user = userEvent.setup();
    render(<NotificationBell notifications={[]} onSelect={() => {}} />);
    await user.click(screen.getByTestId('notification-bell'));
    expect(screen.getByText(/You're all caught up\./)).toBeInTheDocument();
  });

  it('exposes "Mark all read" only when there are unread items + a callback is wired', async () => {
    const onMarkAllRead = vi.fn();
    const user = userEvent.setup();
    render(
      <NotificationBell
        notifications={[sample()]}
        onSelect={() => {}}
        onMarkAllRead={onMarkAllRead}
      />,
    );
    await user.click(screen.getByTestId('notification-bell'));
    await user.click(screen.getByTestId('notification-bell-mark-all-read'));
    expect(onMarkAllRead).toHaveBeenCalled();
  });
});
