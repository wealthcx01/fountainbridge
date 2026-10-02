import { test, expect } from '@playwright/test';
import { testLogin } from './helpers';

/**
 * FB-173 — a voice note in the composer, in a real browser with a simulated microphone.
 *
 * The rig uses the test transcriber (TRANSCRIBER=test-double in playwright.config.ts), which never
 * sends audio anywhere and answers with a fixed sentence that says what it is. Chromium's fake
 * microphone plays a tone, so there is something to record.
 *
 * The second test is the fault review found: when the sign-in has run out, the gate answers with a
 * redirect to the login page. Before the fix the browser followed it, read the login page as "the
 * studio cannot use this recording", and deleted the note.
 */
const JOHN = 'john.gallagher@wealthcx.com';
const WORDS = 'This is the test transcriber, not a real transcript.';

test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['microphone'],
});

test.describe('a voice note (FB-173)', () => {
  test.beforeEach(async ({ page }) => {
    await testLogin(page, JOHN);
  });

  test('record, stop, and the words land after what was typed; nothing is filed', async ({ page }) => {
    await page.goto('/venture/arca/composer');
    const box = page.getByTestId('composer-input');
    await expect(box).toBeVisible();
    await expect(page.getByTestId('voice-where')).toContainText('does not keep the recording');
    await box.fill('About the share link:');

    await page.getByTestId('voice-start').click();
    await expect(page.getByTestId('voice-stop')).toBeVisible();
    await page.waitForTimeout(1200);
    await page.getByTestId('voice-stop').click();

    await expect(box).toHaveValue(`About the share link:\n\n${WORDS}`);
    await expect(page.getByTestId('voice-failed')).toHaveCount(0);
    // Nothing was sent to the team: the words are in the box, waiting for the founder's own Send.
    await expect(page.getByTestId('composer-send')).toBeEnabled();
    await expect(page.getByTestId('voice-earlier')).toHaveCount(0);
  });

  test('an expired sign-in keeps the recording, says to sign in, and offers it again after', async ({ page, context }) => {
    await page.goto('/venture/arca/composer');
    await expect(page.getByTestId('composer-input')).toBeVisible();

    await page.getByTestId('voice-start').click();
    await expect(page.getByTestId('voice-stop')).toBeVisible();
    await page.waitForTimeout(1200);
    // The sign-in runs out while the founder is talking.
    await context.clearCookies();
    await page.getByTestId('voice-stop').click();

    const failed = page.getByTestId('voice-failed');
    await expect(failed).toBeVisible();
    await expect(failed).toContainText('sign in again');
    await expect(failed).not.toContainText('could not use that recording');
    await expect(page.getByTestId('voice-retry')).toBeVisible();

    // Sign back in, come back: the note is still on this device, and sending it now works.
    await testLogin(page, JOHN);
    await page.goto('/venture/arca/composer');
    await expect(page.getByTestId('voice-earlier')).toBeVisible();
    await page.getByTestId('voice-send-earlier').click();
    await expect(page.getByTestId('composer-input')).toHaveValue(WORDS);
    await expect(page.getByTestId('voice-earlier')).toHaveCount(0);
  });
});
