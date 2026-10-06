import { expect, test } from "@playwright/test";

// FB-005 acceptance: the three venture-scoping cases, driven through the guarded dev-login
// (STUDIO_DEV_LOGIN=1, set by playwright.config webServer env).
async function devLogin(page: import("@playwright/test").Page, email: string) {
  await page.goto(`/api/auth/dev-login?email=${encodeURIComponent(email)}`);
  await page.waitForURL("**/");
}

test("Bruntsfield admin (John) sees every venture", async ({ page }) => {
  await devLogin(page, "john.gallagher@wealthcx.com");
  await expect(page.getByRole("heading", { name: "Ventures" })).toBeVisible();
  await expect(page.getByText("THE RESET")).toBeVisible();
  await expect(page.getByText("ARCA")).toBeVisible();
  await expect(page.getByText("All ventures — Bruntsfield")).toBeVisible();
});

test("a founder sees only their venture and is refused another", async ({ page }) => {
  await devLogin(page, "ross@thereset.com");
  await expect(page.getByText("THE RESET")).toBeVisible();
  await expect(page.getByText("ARCA")).toHaveCount(0);

  // Server-side scoping: opening a non-owned venture is refused (403 view).
  await page.goto("/venture/arca");
  await expect(page.getByTestId("not-authorized")).toBeVisible();
});

test("an unlisted account is refused", async ({ page }) => {
  await devLogin(page, "nobody@example.org");
  await expect(page.getByText("No ventures for this account")).toBeVisible();
  await expect(page.getByText("THE RESET")).toHaveCount(0);
});

test("a signed-out visitor is prompted to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to the studio" })).toBeVisible();
});
