import type { Page } from '@playwright/test';

/** Sign in via the env-gated E2E credentials provider, then wait until we leave /login. */
export async function testLogin(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('e2e-email').fill(email);
  await page.getByTestId('e2e-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
