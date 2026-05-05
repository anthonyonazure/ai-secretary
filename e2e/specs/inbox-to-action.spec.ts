import { expect, test } from '../fixtures/playwright-fixtures.js';

test.describe('inbox-to-action golden path', () => {
  test('signs in, opens a meeting, finds action items in My Actions', async ({
    page,
    stack,
    webBaseUrl,
  }) => {
    const { admin, meeting, actionItems } = stack.seed;

    await page.goto(`${webBaseUrl}/login`);

    const emailField = page.getByLabel(/email/i);
    const passwordField = page.getByLabel(/password/i);
    await expect(emailField).toBeVisible();
    await emailField.fill(admin.email);
    await passwordField.fill(admin.password);
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(new RegExp(`${webBaseUrl}/inbox$`));
    await expect(page.getByRole('heading', { name: /inbox/i })).toBeVisible();

    const meetingLink = page.getByTestId(`inbox-meeting-${meeting.id}`);
    await expect(meetingLink).toBeVisible();
    await expect(meetingLink).toContainText(meeting.title);
    await meetingLink.click();

    await expect(page).toHaveURL(new RegExp(`${webBaseUrl}/meetings/${meeting.id}$`));
    await expect(page.getByTestId('meeting-id-display')).toContainText(meeting.id);

    // Bot controls are present on every meeting; with no active session,
    // the invite-bot CTA renders. The badge slot stays empty until a
    // bot.join job lands. We don't drive the full invite flow here
    // (that needs the bot-join handler running), but we DO assert the
    // CTA exists and is clickable so the surface stays wired.
    const botControls = page.getByTestId('meeting-bot-controls');
    await expect(botControls).toBeVisible();
    await expect(botControls.getByTestId('invite-bot-cta')).toBeVisible();

    // Transcript tab is revealed once turns load.
    const transcriptTab = page.getByTestId('meeting-tab-transcript');
    await expect(transcriptTab).toBeVisible();
    await transcriptTab.click();

    const transcriptList = page.getByTestId('meeting-transcript-list');
    await expect(transcriptList).toBeVisible();
    const firstTurn = meeting.speakerTurns[0];
    if (!firstTurn) throw new Error('seed missing speaker turns');
    await expect(transcriptList).toContainText(firstTurn.text);
    await expect(page.getByTestId(`turn-${firstTurn.turnId}`)).toBeVisible();

    // Actions tab is revealed because the seeded meeting has at least one action item.
    const meetingActionItem = actionItems.find((a) => a.meetingId === meeting.id);
    if (!meetingActionItem) throw new Error('seed missing action item bound to primary meeting');
    const actionsTab = page.getByTestId('meeting-tab-actions');
    await expect(actionsTab).toBeVisible();
    await actionsTab.click();
    const meetingActionsList = page.getByTestId('meeting-action-items-list');
    await expect(meetingActionsList).toBeVisible();
    await expect(meetingActionsList).toContainText(meetingActionItem.text);

    await page
      .getByRole('navigation', { name: /primary/i })
      .getByRole('link', { name: /my actions/i })
      .click();
    await expect(page).toHaveURL(new RegExp(`${webBaseUrl}/actions$`));
    await expect(page.getByRole('heading', { name: /my actions/i })).toBeVisible();

    const list = page.getByTestId('action-items-list');
    await expect(list).toBeVisible();

    const cards = list.getByTestId('action-item-card');
    await expect(cards).toHaveCount(actionItems.length);

    const firstItemText = actionItems[0]?.text;
    if (!firstItemText) throw new Error('seed missing action item');
    await expect(list).toContainText(firstItemText);

    const openCard = cards.filter({ hasText: firstItemText }).first();
    await expect(openCard).toHaveAttribute('data-status', 'pending');
    await expect(openCard.getByTestId('mark-done')).toBeVisible();
  });
});
