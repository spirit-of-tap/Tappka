import { expect, test } from "@playwright/test";
import {
  getSetupSessionCookie,
  seedBook,
  seedEssay,
  setAuthCookie,
} from "./fixtures/auth";

test.describe("reading feature - unauthenticated", () => {
  test("prehled page redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/prehled");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("eseje page redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/eseje");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("hledat page redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/hledat");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("knihovna page redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/knihovna");
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

  test("prehled page loads for authenticated user", async ({ page }) => {
    const response = await page.goto("/prehled");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });

  test("eseje nova page loads for authenticated user", async ({ page }) => {
    const response = await page.goto("/eseje/nova");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });

  test("hledat page loads for authenticated user", async ({ page }) => {
    const response = await page.goto("/hledat");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });

  test("knihovna page redirects to /hledat for authenticated user", async ({ page }) => {
    const response = await page.goto("/knihovna");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/hledat/);
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

  test("knihovna/nova - Zpět do knihovny navigates to /hledat", async ({ page }) => {
    await page.goto("/knihovna/nova");
    await expect(page.getByRole("link", { name: /zpět/i })).toBeVisible();
    await page.getByRole("link", { name: /zpět/i }).click();
    await expect(page).toHaveURL(/\/hledat/);
  });

  test("knihovna/[bookId] - Zpět do knihovny navigates to /hledat", async ({ page }) => {
    await page.goto(`/knihovna/${bookId}`);
    await expect(page.getByRole("link", { name: /zpět/i })).toBeVisible();
    await page.getByRole("link", { name: /zpět/i }).click();
    await expect(page).toHaveURL(/\/hledat/);
  });

  test("eseje/nova - Zpět (router.back) navigates back", async ({ page }) => {
    await page.goto("/hledat");
    const response = await page.goto("/eseje/nova");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=Zpět").first()).toBeVisible({ timeout: 10000 });
    await page.locator("text=Zpět").first().click();
    await expect(page).toHaveURL(/\/hledat/);
  });

  test("eseje/[essayId] - Zpět (router.back) navigates back", async ({ page }) => {
    await page.goto("/hledat");
    const response = await page.goto(`/eseje/${essayId}`);
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=Zpět").first()).toBeVisible({ timeout: 10000 });
    await page.locator("text=Zpět").first().click();
    await expect(page).toHaveURL(/\/hledat/);
  });

  test("eseje/[essayId]/upravit - Zpět na esej navigates to essay", async ({ page }) => {
    await page.goto(`/eseje/${essayId}/upravit`);
    await expect(page.getByRole("link", { name: /zpět/i })).toBeVisible();
    await page.getByRole("link", { name: /zpět/i }).click();
    await expect(page).toHaveURL(new RegExp(`/eseje/${essayId}$`));
  });
});
