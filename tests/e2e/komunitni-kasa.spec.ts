import { expect, test } from "@playwright/test";

import { cleanupTestData, getSetupSessionCookie, setAuthCookie } from "./fixtures/auth";

const ROUTES = [
  { path: "/komunitni-kasa", heading: "Komunitní kasa" },
  { path: "/komunitni-kasa/pohyby", heading: "Všechny pohyby" },
  { path: "/komunitni-kasa/znacka", heading: "Značka a materiály" },
  { path: "/komunitni-kasa/dokumenty", heading: "Dokumenty spolku" },
  { path: "/komunitni-kasa/dokumenty/stanovy", heading: "Stanovy" },
  { path: "/komunitni-kasa/dokumenty/smernice", heading: "Směrnice o rozhodování o výdajích" },
] as const;

/** Volitelné snímky pro vizuální kontrolu: KASA_SCREENSHOT_DIR=/cesta pnpm exec playwright test komunitni-kasa */
const SCREENSHOT_DIR = process.env.KASA_SCREENSHOT_DIR;
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 900 },
] as const;
const THEMES = ["light", "dark"] as const;

let cookie = "";

test.beforeAll(async () => {
  ({ cookie } = await getSetupSessionCookie(undefined, "admin"));
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("komunitní kasa", () => {
  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookie);
  });

  for (const route of ROUTES) {
    test(`${route.path} renders`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
    });
  }

  test("old stanovy URL redirects to the documents area", async ({ page }) => {
    await page.goto("/komunitni-kasa/stanovy");
    await expect(page).toHaveURL(/\/komunitni-kasa\/dokumenty\/stanovy$/);
  });

  test("main page keeps rules and contact visible without bank data", async ({ page }) => {
    await page.route("**/api/komunitni-kasa", (r) => r.fulfill({ status: 502, body: '{"error":"Banka neodpovídá"}' }));
    await page.goto("/komunitni-kasa");
    await expect(page.getByText("Data se nepodařilo načíst")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Jak se o penězích rozhoduje" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kontakt" })).toBeVisible();
  });

  test("brand page downloads a PNG", async ({ page }) => {
    await page.goto("/komunitni-kasa/znacka");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Stáhnout Sestava s textem jako PNG" }).click();
    expect((await download).suggestedFilename()).toBe("komunitni-kasa_sestava.png");
    if (SCREENSHOT_DIR) await (await download).saveAs(`${SCREENSHOT_DIR}/download-sestava.png`);
  });

  test("screenshots for visual review", async ({ page }) => {
    test.skip(!SCREENSHOT_DIR, "set KASA_SCREENSHOT_DIR to capture");
    test.setTimeout(180_000);
    for (const theme of THEMES) {
      await page.addInitScript((t) => {
        localStorage.setItem("theme", t);
        localStorage.setItem("tappka-consent-at", String(Date.now()));
      }, theme);
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        for (const route of ROUTES) {
          await page.goto(route.path);
          await page.waitForLoadState("networkidle");
          const name = route.path.replaceAll("/", "_").replace(/^_/, "");
          await page.screenshot({ path: `${SCREENSHOT_DIR}/${theme}-${viewport.name}-${name}.png`, fullPage: true });
        }
      }
    }
  });
});
