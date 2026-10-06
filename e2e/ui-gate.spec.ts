import { expect, test } from "@playwright/test";

// FB-005 UI-gate: capture a screenshot gallery of the shell for PR review (one set per project —
// desktop + mobile). Screenshots land in e2e/__screenshots__/<project>/.
async function devLogin(page: import("@playwright/test").Page, email: string) {
  await page.goto(`/api/auth/dev-login?email=${encodeURIComponent(email)}`);
  await page.waitForURL("**/");
}

test("gallery: signed-out sign-in", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to the studio" })).toBeVisible();
  await page.screenshot({ path: `e2e/__screenshots__/${testInfo.project.name}/01-signin.png`, fullPage: true });
});

test("gallery: admin ventures overview", async ({ page }, testInfo) => {
  await devLogin(page, "john.gallagher@wealthcx.com");
  await expect(page.getByRole("heading", { name: "Ventures" })).toBeVisible();
  await page.screenshot({ path: `e2e/__screenshots__/${testInfo.project.name}/02-ventures.png`, fullPage: true });
});

test("gallery: venture detail", async ({ page }, testInfo) => {
  await devLogin(page, "john.gallagher@wealthcx.com");
  await page.goto("/venture/the-reset");
  await expect(page.getByRole("heading", { name: "THE RESET" })).toBeVisible();
  await page.screenshot({ path: `e2e/__screenshots__/${testInfo.project.name}/03-venture-detail.png`, fullPage: true });
});

test("gallery: attention placeholder", async ({ page }, testInfo) => {
  await devLogin(page, "john.gallagher@wealthcx.com");
  await page.goto("/attention");
  await expect(page.getByRole("heading", { name: "Attention" })).toBeVisible();
  await page.screenshot({ path: `e2e/__screenshots__/${testInfo.project.name}/04-attention.png`, fullPage: true });
});
