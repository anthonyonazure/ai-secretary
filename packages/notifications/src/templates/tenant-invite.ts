import { type RenderedEmail, escapeHtml } from './render.js';

/**
 * Tenant-invite delivery email (Story 1.5d consumer — invites a new
 * member to join an org via the accept-invite link).
 *
 * Context shape:
 *   - tenantName: string   — workspace display name
 *   - inviterName: string  — admin who created the invite
 *   - role: string         — role the recipient will hold on accept
 *   - acceptUrl: string    — URL containing the plaintext invite token
 *   - expiresAt: string    — ISO 8601 timestamp; surfaced verbatim
 *
 * Subject pattern: `You're invited to join <tenantName>`.
 */
export const renderTenantInvite = (args: {
  context: Record<string, unknown>;
  locale: string;
}): RenderedEmail => {
  const ctx = args.context;
  const tenantName =
    typeof ctx.tenantName === 'string' && ctx.tenantName.length > 0
      ? ctx.tenantName
      : 'a workspace';
  const inviterName =
    typeof ctx.inviterName === 'string' && ctx.inviterName.length > 0
      ? ctx.inviterName
      : 'A teammate';
  const role = typeof ctx.role === 'string' ? ctx.role : 'member';
  const acceptUrl = typeof ctx.acceptUrl === 'string' ? ctx.acceptUrl : '#';
  const expiresAt = typeof ctx.expiresAt === 'string' ? ctx.expiresAt : 'soon';

  const subject = `You're invited to join ${tenantName}`;

  const html = `<!doctype html>
<html lang="en">
  <body style="font-family: system-ui, sans-serif; color: #111;">
    <h1>You're invited to join ${escapeHtml(tenantName)}</h1>
    <p>
      ${escapeHtml(inviterName)} invited you to join
      <strong>${escapeHtml(tenantName)}</strong> on AI Secretary as a
      <strong>${escapeHtml(role)}</strong>.
    </p>
    <p>
      Accept this invite to set your password and start collaborating.
      The link expires on <strong>${escapeHtml(expiresAt)}</strong>.
    </p>
    <p>
      <a href="${escapeHtml(acceptUrl)}"
         style="display: inline-block; padding: 12px 18px;
                background: #111; color: #fff; text-decoration: none;
                border-radius: 6px;">
        Accept invite
      </a>
    </p>
    <p style="font-size: 12px; color: #666;">
      If you weren't expecting this invitation, you can safely ignore this email.
    </p>
  </body>
</html>`;

  const text = [
    `You're invited to join ${tenantName}`,
    '',
    `${inviterName} invited you to join ${tenantName} on AI Secretary as a ${role}.`,
    '',
    'Accept your invite:',
    acceptUrl,
    '',
    `This link expires on ${expiresAt}.`,
    '',
    "If you weren't expecting this invitation, you can safely ignore this email.",
  ].join('\n');

  return { subject, html, text };
};
