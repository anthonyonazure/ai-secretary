/**
 * Mobile-side wire shape for in-app notifications. Mirrors the web
 * `InAppNotification` type but lives here so the mobile test runner
 * can import it without crossing into the web app's tsconfig.
 */

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
  unread: boolean;
  href?: string | null;
}
