import { type RenderedEmail, escapeHtml } from './render.js';

/**
 * Trial reminder email (Story 13.7 consumer).
 *
 * Context shape:
 *   - userName: string
 *   - tenantName: string
 *   - daysLeft: number      — used for 'ending-soon' phase
 *   - upgradeUrl: string    — billing page deep-link
 */
export const renderTrialReminder = (args: {
  context: Record<string, unknown>;
  locale: string;
  phase: 'ending-soon' | 'expired';
}): RenderedEmail => {
  const ctx = args.context;
  const userName = typeof ctx.userName === 'string' ? ctx.userName : 'there';
  const tenantName = typeof ctx.tenantName === 'string' ? ctx.tenantName : 'your workspace';
  const daysLeft = typeof ctx.daysLeft === 'number' ? ctx.daysLeft : 3;
  const upgradeUrl =
    typeof ctx.upgradeUrl === 'string' ? ctx.upgradeUrl : 'https://aisecretary.app/billing';

  const subject =
    args.phase === 'ending-soon'
      ? `Your AI Secretary trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
      : 'Your AI Secretary trial has ended';

  const headline =
    args.phase === 'ending-soon'
      ? `Your trial for ${tenantName} ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
      : `Your trial for ${tenantName} has ended.`;

  const cta = args.phase === 'ending-soon' ? 'Upgrade to keep going' : 'Reactivate';

  const html = `<!doctype html>
<html lang="en">
  <body style="font-family: system-ui, sans-serif; color: #111;">
    <h1>${escapeHtml(headline)}</h1>
    <p>Hi ${escapeHtml(userName)},</p>
    <p>
      Add a payment method now to keep recordings, transcripts, and
      analysis flowing without interruption.
    </p>
    <p>
      <a href="${escapeHtml(upgradeUrl)}"
         style="display: inline-block; padding: 12px 18px;
                background: #111; color: #fff; text-decoration: none;
                border-radius: 6px;">
        ${escapeHtml(cta)}
      </a>
    </p>
    <p style="font-size: 12px; color: #666;">
      Questions? Reply to this email or reach billing@aisecretary.app.
    </p>
  </body>
</html>`;

  const text = [
    headline,
    '',
    `Hi ${userName},`,
    '',
    'Add a payment method now to keep recordings, transcripts, and analysis flowing without interruption.',
    `${cta}: ${upgradeUrl}`,
    '',
    'Questions? Reply to this email or reach billing@aisecretary.app.',
  ].join('\n');

  return { subject, html, text };
};
