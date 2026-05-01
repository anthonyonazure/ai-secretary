import { type RenderedEmail, escapeHtml } from './render.js';

/**
 * Re-engagement email template (Story 1.7 consumer).
 *
 * Context shape:
 *   - userName: string  — recipient's display name
 *   - tenantName: string — org name (for "back at <Acme>")
 *   - resumeUrl: string — deep link into the app
 *
 * Localization: minimal stub — we only ship 'en' here. The i18next-backed
 * variant lands in Story 1.9 (i18n bootstrap); until then, locales other
 * than 'en' fall back to English copy.
 */
export const renderReEngagement = (args: {
  context: Record<string, unknown>;
  locale: string;
  hoursIdle: 24 | 72;
}): RenderedEmail => {
  const ctx = args.context;
  const userName = typeof ctx.userName === 'string' ? ctx.userName : 'there';
  const tenantName = typeof ctx.tenantName === 'string' ? ctx.tenantName : 'your workspace';
  const resumeUrl = typeof ctx.resumeUrl === 'string' ? ctx.resumeUrl : 'https://aisecretary.app';

  const subject =
    args.hoursIdle === 24
      ? `${userName}, your meetings are waiting`
      : `Still here? Pick up where you left off in ${tenantName}`;

  const headline =
    args.hoursIdle === 24
      ? 'Your AI Secretary noticed you stepped away.'
      : "It's been a few days — let's get you back in.";

  const html = `<!doctype html>
<html lang="en">
  <body style="font-family: system-ui, sans-serif; color: #111;">
    <h1>${escapeHtml(headline)}</h1>
    <p>Hi ${escapeHtml(userName)},</p>
    <p>
      You have unreviewed meeting analyses in
      <strong>${escapeHtml(tenantName)}</strong>.
      Pick up where you left off:
    </p>
    <p>
      <a href="${escapeHtml(resumeUrl)}"
         style="display: inline-block; padding: 12px 18px;
                background: #111; color: #fff; text-decoration: none;
                border-radius: 6px;">
        Open AI Secretary
      </a>
    </p>
    <p style="font-size: 12px; color: #666;">
      You're receiving this because you have re-engagement reminders enabled.
      Manage notification preferences in your account settings.
    </p>
  </body>
</html>`;

  const text = [
    headline,
    '',
    `Hi ${userName},`,
    '',
    `You have unreviewed meeting analyses in ${tenantName}.`,
    `Pick up where you left off: ${resumeUrl}`,
    '',
    "You're receiving this because you have re-engagement reminders enabled.",
    'Manage notification preferences in your account settings.',
  ].join('\n');

  return { subject, html, text };
};
