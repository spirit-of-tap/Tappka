import { expect, test, type Page } from "@playwright/test";

import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  grantBetaAccess,
  seedTrainingSession,
  setAuthCookie,
} from "./fixtures/auth";

const HOUR_MS = 60 * 60 * 1000;
const THEMES = ["light", "dark"] as const;
const SCREENSHOT_DIR = process.env.TS_SCREENSHOT_DIR;
const CONSENT_BANNER_WAIT_MS = 5_000;

/** Opens the TS and closes the consent banner, which otherwise covers the attachments area. */
async function openSession(page: Page, sessionId: string): Promise<void> {
  await page.goto(`/ts/${sessionId}`);
  // The banner appears after hydration, so wait briefly for it instead of checking once.
  const decline = page.getByRole("button", { name: "Odmítnout" });
  await decline
    .waitFor({ state: "visible", timeout: CONSENT_BANNER_WAIT_MS })
    .then(() => decline.click())
    .catch(() => {});
}

const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });

test.describe("TS příprava – přílohy a zpráva do Teams", () => {
  test.describe.configure({ mode: "serial" });

  let cookie: string;
  let sessionId: string;

  test.beforeAll(async () => {
    const teamId = await createTestTeam();
    const user = await getSetupSessionCookie(teamId);
    await grantBetaAccess(user.profileId);
    cookie = user.cookie;
    const startsAt = new Date(Date.now() + 24 * HOUR_MS).toISOString();
    const endsAt = new Date(Date.now() + 26 * HOUR_MS).toISOString();
    ({ sessionId } = await seedTrainingSession(teamId, user.profileId, { startsAt, endsAt, facilitate: true }));
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookie);
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("blocks a file named as the preparation itself", async ({ page }) => {
    await openSession(page, sessionId);
    await page.getByRole("button", { name: /Přidat přílohu/ }).click();
    await expect(page.getByRole("dialog", { name: "Přidat přílohu" }).getByText(/Jen podklady/)).toBeVisible();

    await page.getByLabel("Co příloha obsahuje").fill("Podklady");
    await page.getByLabel("Soubor").setInputFiles(pdf("Příprava_TS_12.pdf"));
    await page.getByRole("button", { name: "Přidat", exact: true }).click();

    await expect(page.getByText("Vypadá to, že nahráváš samotnou přípravu", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: /Stáhnout/ })).toHaveCount(0);
  });

  test("uploads, downloads and removes a labelled supporting document", async ({ page }) => {
    await openSession(page, sessionId);

    await page.getByRole("button", { name: /Přidat přílohu/ }).click();
    await page.getByLabel("Co příloha obsahuje").fill("Kniha k přečtení");
    await page.getByLabel("Soubor").setInputFiles(pdf("atomove-navyky.pdf"));
    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/ts-attachment-dialog.png` });
    await page.getByRole("button", { name: "Přidat", exact: true }).click();

    const link = page.getByRole("link", { name: "Stáhnout Kniha k přečtení" });
    await expect(link).toBeVisible();
    await expect(page.getByText(/atomove-navyky\.pdf/)).toBeVisible();

    const href = await link.getAttribute("href");
    const res = await page.request.get(href!, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toContain("download=atomove-navyky.pdf");

    if (SCREENSHOT_DIR) {
      for (const theme of THEMES) {
        await page.evaluate((t) => {
          localStorage.setItem("theme", t);
        }, theme);
        await page.reload();
        await page.waitForLoadState("networkidle");
        const decline = page.getByRole("button", { name: "Odmítnout" });
        if (await decline.isVisible()) await decline.click();
        await page.getByRole("heading", { name: /Přílohy/ }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SCREENSHOT_DIR}/ts-attachments-${theme}.png` });
      }
    }

    await page.getByRole("button", { name: "Odebrat Kniha k přečtení" }).click();
    await page.getByRole("button", { name: "Odebrat", exact: true }).click();
    await expect(page.getByText("Příloha odebrána")).toBeVisible();
    await expect(link).toHaveCount(0);
  });

  test("offers the Teams announcement only once the preparation is saved", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openSession(page, sessionId);
    const copyButton = page.getByRole("button", { name: "Zkopírovat zprávu do Teams" });
    await expect(copyButton).toHaveCount(0);

    await page.locator(".ProseMirror").fill("Přečtěte si knihu v příloze");
    await page.getByRole("button", { name: "Uložit" }).click();
    await expect(copyButton).toBeVisible();

    if (SCREENSHOT_DIR) {
      for (const theme of THEMES) {
        await page.evaluate((t) => localStorage.setItem("theme", t), theme);
        await page.reload();
        const decline = page.getByRole("button", { name: "Odmítnout" });
        if (await decline.isVisible()) await decline.click();
        await copyButton.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SCREENSHOT_DIR}/ts-teams-${theme}.png` });
      }
    }

    await copyButton.click();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain("je připravená v Tappce:");
    expect(clipboard).toContain(`/ts/${sessionId}`);
    expect(clipboard).toContain("E2E Test User");
  });
});
