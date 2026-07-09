import { expect, test } from "@playwright/test";

test("public login page serves and renders", async ({ page }) => {
  const response = await page.goto("/auth/login");
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator("body")).toBeVisible();
});
