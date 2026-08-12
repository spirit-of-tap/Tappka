import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  getSetupSessionCookie,
  seedBook,
  seedEssay,
  setAuthCookie,
} from "./fixtures/auth";

test.describe("reading feature - unauthenticated", () => {
  test("cteni/prehled redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/cteni/prehled");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("cteni/eseje/nova redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/cteni/eseje/nova");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("cteni/hledat redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/cteni/hledat");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe("reading feature - authenticated", () => {
  let cookieValue: string;

  test.beforeAll(async () => {
    const { cookie } = await getSetupSessionCookie();
    cookieValue = cookie;
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookieValue);
  });

  test("cteni/prehled page loads for authenticated user", async ({ page }) => {
    const response = await page.goto("/cteni/prehled");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });

  test("cteni/eseje/nova page loads for authenticated user", async ({ page }) => {
    const response = await page.goto("/cteni/eseje/nova");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });

  test("cteni/hledat page loads for authenticated user", async ({ page }) => {
    const response = await page.goto("/cteni/hledat");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("reading navigation - arrow back", () => {
  let cookieValue: string;
  let bookId: string;
  let essayId: string;

  test.beforeAll(async () => {
    const {
      cookie,
      profileId: pid,
    } = await getSetupSessionCookie();
    cookieValue = cookie;

    const { bookId: bid } = await seedBook(pid);
    bookId = bid;

    const { essayId: eid } = await seedEssay(pid, bid);
    essayId = eid;
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookieValue);
  });

  test("cteni/knihy/nova - Zpět do hledání navigates to /cteni/hledat", async ({ page }) => {
    await page.goto("/cteni/knihy/nova");
    await expect(page.getByRole("link", { name: /zpět/i })).toBeVisible();
    await page.getByRole("link", { name: /zpět/i }).click();
    await expect(page).toHaveURL(/\/cteni\/hledat/);
  });

  test("cteni/knihy/[bookId] - Zpět do hledání navigates to /cteni/hledat", async ({ page }) => {
    await page.goto(`/cteni/knihy/${bookId}`);
    await expect(page.getByRole("link", { name: /zpět/i })).toBeVisible();
    await page.getByRole("link", { name: /zpět/i }).click();
    await expect(page).toHaveURL(/\/cteni\/hledat/);
  });

  test("cteni/eseje/nova - Zpět (router.back) navigates back", async ({ page }) => {
    await page.goto("/cteni/hledat");
    const response = await page.goto("/cteni/eseje/nova");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=Zpět").first()).toBeVisible({ timeout: 10000 });
    await page.locator("text=Zpět").first().click();
    await expect(page).toHaveURL(/\/cteni\/hledat/);
  });

  test("cteni/eseje/[essayId] - Zpět (router.back) navigates back", async ({ page }) => {
    await page.goto("/cteni/hledat");
    const response = await page.goto(`/cteni/eseje/${essayId}`);
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=Zpět").first()).toBeVisible({ timeout: 10000 });
    await page.locator("text=Zpět").first().click();
    await expect(page).toHaveURL(/\/cteni\/hledat/);
  });

  test("cteni/eseje/[essayId]/upravit - Zpět na esej navigates to essay", async ({ page }) => {
    await page.goto(`/cteni/eseje/${essayId}/upravit`);
    await expect(page.getByRole("link", { name: /zpět/i })).toBeVisible();
    await page.getByRole("link", { name: /zpět/i }).click();
    await expect(page).toHaveURL(new RegExp(`/cteni/eseje/${essayId}$`));
  });
});

test.afterAll(async () => {
  await cleanupTestData();
});
