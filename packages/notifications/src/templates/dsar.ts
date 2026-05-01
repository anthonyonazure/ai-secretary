import { type RenderedEmail, escapeHtml } from './render.js';

/**
 * DSAR delivery email (Story 14.1 consumer — GDPR data-subject access
 * request fulfillment).
 *
 * Context shape:
 *   - userName: string
 *   - downloadUrl: string  — short-lived presigned URL to the export bundle
 *   - expiresAt: string    — ISO 8601; surfaced in copy verbatim
 *   - requestId: string    — DSAR request id for audit-trail referencing
 */
export const renderDsar = (args: {
  context: Record<string, unknown>;
  locale: string;
}): RenderedEmail => {
  const ctx = args.context;
  const userName = typeof ctx.userName === 'string' ? ctx.userName : 'there';
  const downloadUrl = typeof ctx.downloadUrl === 'string' ? ctx.downloadUrl : '#';
  const expiresAt = typeof ctx.expiresAt === 'string' ? ctx.expiresAt : 'soon';
  const requestId = typeof ctx.requestId === 'string' ? ctx.requestId : 'unknown';

  const subject = 'Your data export is ready';

  const html = `<!doctype html>
<html lang="en">
  <body style="font-family: system-ui, sans-serif; color: #111;">
    <h1>Your data export is ready</h1>
    <p>Hi ${escapeHtml(userName)},</p>
    <p>
      The data export you requested has been prepared. Use the link below
      to download your archive. The link expires at
      <strong>${escapeHtml(expiresAt)}</strong>.
    </p>
    <p>
      <a href="${escapeHtml(downloadUrl)}"
         style="display: inline-block; padding: 12px 18px;
                background: #111; color: #fff; text-decoration: none;
                border-radius: 6px;">
        Download archive
      </a>
    </p>
    <p style="font-size: 12px; color: #666;">
      DSAR request id: <code>${escapeHtml(requestId)}</code>.
      Contact privacy@aisecretary.app with this id if you have questions.
    </p>
  </body>
</html>`;

  const text = [
    'Your data export is ready',
    '',
    `Hi ${userName},`,
    '',
    'The data export you requested has been prepared.',
    `Download archive: ${downloadUrl}`,
    `Link expires at: ${expiresAt}`,
    '',
    `DSAR request id: ${requestId}`,
    'Contact privacy@aisecretary.app with this id if you have questions.',
  ].join('\n');

  return { subject, html, text };
};
