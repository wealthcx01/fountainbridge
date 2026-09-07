import { test, expect, type Page } from '@playwright/test';

// The three FB-005 acceptance cases, end to end against a running server:
//   1. John (admin) → all ventures
//   2. Ross (the-reset founder) → only the-reset
//   3. an unlisted account → refused
// Each captures a screenshot into e2e/__screenshots__ for the PR UI-gate gallery.

const SHOTS = 'e2e/__screenshots__';

async function testLogin(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('e2e-email').fill(email);
  await page.getByTestId('e2e-submit').click();
  // Leave /login once the session is set — either to '/' or a redirect (e.g. /not-authorized).
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

test('admin (John) sees every venture', async ({ page }) => {
  // FB-136 turned the admin's grid of cards into the ledger. The property is unchanged: every
  // venture, and only an admin.
  await testLogin(page, 'john.gallagher@wealthcx.com');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('ledger-table')).toBeVisible();
  await expect(page.getByTestId('ledger-row-arca')).toBeVisible();
  await expect(page.getByTestId('ledger-row-the-reset')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-admin-all-ventures.png`, fullPage: true });
});

test('founder (Ross) sees only the-reset', async ({ page }) => {
  // FB-066 changed the surface but not the property: a founder with one venture is taken straight
  // into it instead of being shown a list of one. Isolation is asserted on what he can REACH, which
  // is the thing that actually matters and is enforced server-side (CLAUDE.md #6) — a picker he
  // cannot see was never the guarantee.
  await testLogin(page, 'ross@bruntsfield.capital');
  await page.goto('/');
  await expect(page).toHaveURL(/\/venture\/the-reset$/);
  await page.screenshot({ path: `${SHOTS}/02-founder-scoped.png`, fullPage: true });

  // And ARCA is still refused when asked for by name, not merely absent from a list.
  await page.goto('/venture/arca');
  await expect(page.getByTestId('venture-forbidden')).toBeVisible();
  await expect(page.getByTestId('col-todo')).toHaveCount(0);
});

test('an unlisted account is refused', async ({ page }) => {
  await testLogin(page, 'stranger@example.com');
  await expect(page).toHaveURL(/\/not-authorized$/);
  await expect(page.getByTestId('not-authorized')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/03-not-authorized.png`, fullPage: true });
});

test('signed-out visitor is sent to login (no public pages, FB-015)', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL((url) => url.pathname.startsWith('/login'));
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  await expect(page.getByTestId('ledger')).toHaveCount(0); // studio data never shown signed-out
  await page.screenshot({ path: `${SHOTS}/04-login.png`, fullPage: true });
});

test('middleware gates a placeholder route for a signed-out visitor', async ({ page }) => {
  // Proves the `authorized` callback is wired: /lanes has no page-level guard of its own yet,
  // so it must be the middleware that redirects an unauthenticated request to /login.
  await page.goto('/lanes');
  await page.waitForURL((url) => url.pathname.startsWith('/login'));
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
});

/**
 * FB-200 — a tool client cannot follow a login redirect.
 *
 * The MCP endpoint is reached by a machine holding a ticket in a header, with no cookie and no
 * browser. Gated by the middleware it answered `307` to a login page, which a tool client cannot
 * follow and cannot report: from the outside it looked exactly like a studio that was up and
 * refusing to talk.
 */
test('the tool endpoint refuses in words, never with a redirect to a login page', async ({ request }) => {
  const res = await request.post('/api/mcp', {
    data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    maxRedirects: 0,
  });
  expect(res.status(), 'a machine cannot follow a redirect').toBe(401);
  const body = await res.json();
  expect(body.error.message).toMatch(/ticket/i);
});

test('the tool endpoint refuses a ticket the studio did not issue', async ({ request }) => {
  const res = await request.post('/api/mcp', {
    headers: { authorization: 'Bearer arca.9999999999999.not-a-signature' },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(401);
});
