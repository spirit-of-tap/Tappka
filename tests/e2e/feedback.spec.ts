import { expect, test } from "@playwright/test";
import { getSetupSessionCookie, setAuthCookie } from "./fixtures/auth";

test.describe("zpětná vazba - unauthenticated", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/zpetna-vazba");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe("zpětná vazba - authenticated", () => {
  let cookieValue: string;

  test.beforeAll(async () => {
    const { cookie } = await getSetupSessionCookie();
    cookieValue = cookie;
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookieValue);
  });

  test("page loads and shows the feedback form", async ({ page }) => {
    const response = await page.goto("/zpetna-vazba");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Zpětná vazba" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Zpětná vazba" })).toBeVisible();
  });

  test("submitting a note shows it on the active board", async ({ page }) => {
    await page.goto("/zpetna-vazba");
    const unique = `E2E poznámka ${Date.now()}`;
    await page.getByRole("textbox", { name: "Zpětná vazba" }).fill(unique);
    await page.getByRole("button", { name: /Odeslat/i }).click();
    await expect(page.getByText(unique)).toBeVisible();
  });
});
