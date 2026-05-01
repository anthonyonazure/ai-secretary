/**
 * `NotificationBell` — Story 4.7 substrate.
 *
 * Header-bar bell that shows in-app notifications: transcript-ready,
 * analysis-completed, capture-at-risk, share-received, etc. Clicking
 * the bell opens a dropdown listing recent unread items; clicking one
 * marks it read + navigates.
 *
 * Anti-pattern guarded against (UX spec § Step 5 #4): "Notification
 * anxiety patterns — Slack-style all-or-nothing". The bell is always
 * dismissible per-item; "mark all read" lives in the dropdown footer
 * for users who want it but isn't the default action.
 *
 * Accessibility:
 *   - role="button" on the trigger with aria-label including unread count
 *   - role="menu" on the dropdown with role="menuitem" entries
 *   - Esc closes; focus returns to the trigger
 */

import { Bell, BellDot } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

export type NotificationKind =
  | 'transcript-ready'
  | 'analysis-completed'
  | 'capture-at-risk'
  | 'share-received'
  | 'action-item-due'
  | 'bot-join-failed'
  | 'trial-ending-soon';

export interface InAppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** When unread = true, the bell shows a dot. */
  unread: boolean;
  /** Optional deep-link route. */
  href?: string | null;
}

export interface NotificationBellProps {
  notifications: InAppNotification[];
  onSelect: (notification: InAppNotification) => void;
  onMarkAllRead?: () => void;
}

const KIND_ICON: Record<NotificationKind, ReactNode> = {
  'transcript-ready': '📝',
  'analysis-completed': '✓',
  'capture-at-risk': '⚠',
  'share-received': '↪',
  'action-item-due': '⏰',
  'bot-join-failed': '⚠',
  'trial-ending-soon': '⏳',
};

export function NotificationBell({
  notifications,
  onSelect,
  onMarkAllRead,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const unread = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onClickAway = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current !== e.target
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClickAway);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClickAway);
    };
  }, [open]);

  const Icon = unread > 0 ? BellDot : Bell;
  const label = unread > 0 ? `Notifications — ${unread} unread` : 'Notifications — none unread';

  return (
    <div className="relative">
      <button
        type="button"
        ref={triggerRef}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-muted hover:bg-accent-soft hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid="notification-bell"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {unread > 0 ? (
          <span
            className="absolute right-1 top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-bg"
            data-testid="notification-bell-unread-badge"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={dropdownRef}
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
          data-testid="notification-bell-dropdown"
        >
          <header className="flex items-center justify-between border-b border-border px-3 py-2 text-sm">
            <span className="font-medium">Notifications</span>
            {onMarkAllRead && unread > 0 ? (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                data-testid="notification-bell-mark-all-read"
              >
                Mark all read
              </button>
            ) : null}
          </header>
          {notifications.length === 0 ? (
            <output className="block px-3 py-6 text-center text-sm text-fg-muted">
              You're all caught up.
            </output>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSelect(n);
                      setOpen(false);
                    }}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent-soft focus:outline-none focus-visible:bg-accent-soft"
                    data-testid={`notification-bell-item-${n.id}`}
                  >
                    <span aria-hidden="true" className="mt-0.5">
                      {KIND_ICON[n.kind]}
                    </span>
                    <span className="flex flex-1 flex-col gap-0.5">
                      <span className={`${n.unread ? 'font-medium' : ''}`}>{n.title}</span>
                      {n.body ? <span className="text-xs text-fg-muted">{n.body}</span> : null}
                    </span>
                    {n.unread ? (
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                        aria-label="unread"
                      />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
