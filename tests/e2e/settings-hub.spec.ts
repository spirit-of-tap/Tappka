import { expect, test } from "@playwright/test";

import { cleanupTestData, createTestTeam, getSetupSessionCookie, grantBetaAccess, setAuthCookie } from "./fixtures/auth";

const THEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
] as const;
const SCREENSHOT_DIR = process.env.TS_SCREENSHOT_DIR;

test.describe("Nastavení hub", () => {
  test.describe.configure({ mode: "serial" });
  let cookie: string;

  test.beforeAll(async () => {
    const teamId = await createTestTeam();
    const user = await getSetupSessionCookie(teamId);
    await grantBetaAccess(user.profileId);
    cookie = user.cookie;
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookie);
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("lists the sections a student can use and opens one", async ({ page }) => {
    await page.goto("/settings");
    const nav = page.getByRole("navigation", { name: "Nastavení" });
    await expect(nav.getByRole("link", { name: /Notifikace/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Tagy v Čase/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Místnosti/ })).toHaveCount(0);

    await nav.getByRole("link", { name: /Notifikace/ }).click();
    await expect(page).toHaveURL(/\/settings\/notifikace$/);
    await expect(page.getByRole("heading", { name: "Notifikace" })).toBeVisible();
  });

  test("old room settings URL sends a student back to the hub", async ({ page }) => {
    await page.goto("/reservations/settings");
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("screenshots for visual review", async ({ page }) => {
    test.skip(!SCREENSHOT_DIR, "set TS_SCREENSHOT_DIR to capture");
    for (const theme of THEMES) {
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        for (const path of ["/settings", "/settings/cas"]) {
          await page.goto(path);
          await page.waitForLoadState("networkidle");
          const decline = page.getByRole("button", { name: "Odmítnout" });
          if (await decline.isVisible().catch(() => false)) await decline.click();
          const name = path.replaceAll("/", "_").replace(/^_/, "");
          await page.screenshot({ path: `${SCREENSHOT_DIR}/${theme}-${viewport.name}-${name}.png` });
        }
      }
    }
  });
});
