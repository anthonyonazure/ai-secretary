/**
 * Email-template registry.
 *
 * Each template module exports a `render(context, locale)` function that
 * returns `{ subject, html, text }`. We deliberately use plain
 * tagged-template-literal HTML over React Email here: the package needs
 * to typecheck inside workers (no React renderer hosting), and the
 * template surface is small enough that the indirection isn't worth it.
 *
 * When a richer renderer is needed (Story 4.4+ marketing emails),
 * swap `render()` to delegate to React Email — the public registry
 * surface stays the same.
 */

import type { NotificationKind } from '../types.js';
import { renderDsar } from './dsar.js';
import { renderReEngagement } from './re-engagement.js';
import { renderTenantInvite } from './tenant-invite.js';
import { renderTrialReminder } from './trial-reminder.js';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export type TemplateRenderer = (context: Record<string, unknown>, locale: string) => RenderedEmail;

/**
 * Templates that have explicit email-channel implementations. A
 * `NotificationKind` not in this map is a runtime error if dispatched
 * via email — keep this list tight.
 */
const TEMPLATE_REGISTRY: Partial<Record<NotificationKind, TemplateRenderer>> = {
  're-engagement-24h': (ctx, locale) => renderReEngagement({ context: ctx, locale, hoursIdle: 24 }),
  're-engagement-72h': (ctx, locale) => renderReEngagement({ context: ctx, locale, hoursIdle: 72 }),
  'dsar-ready': (ctx, locale) => renderDsar({ context: ctx, locale }),
  'trial-ending-soon': (ctx, locale) =>
    renderTrialReminder({ context: ctx, locale, phase: 'ending-soon' }),
  'trial-expired': (ctx, locale) => renderTrialReminder({ context: ctx, locale, phase: 'expired' }),
  'tenant-invite': (ctx, locale) => renderTenantInvite({ context: ctx, locale }),
};

/**
 * Render an email template by kind. Throws if no template is registered
 * for the given kind — surface this as a 4xx at the API edge or as a
 * dead-lettered job at the worker edge.
 */
export const renderTemplate = (
  kind: NotificationKind,
  context: Record<string, unknown>,
  locale: string,
): RenderedEmail => {
  const renderer = TEMPLATE_REGISTRY[kind];
  if (!renderer) {
    throw new Error(`No email template registered for kind '${kind}'`);
  }
  return renderer(context, locale);
};

/** List of all kinds with a registered email template — handy for tests. */
export const registeredEmailKinds = (): NotificationKind[] =>
  Object.keys(TEMPLATE_REGISTRY) as NotificationKind[];

/** Trivial HTML escape for template authors. Not a full sanitizer. */
export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
