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
    await expect(page.getByText(meeting.id, { exact: true })).toBeVisible();

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
