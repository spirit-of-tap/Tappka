import { expect, test, type Page } from "@playwright/test";

import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  grantBetaAccess,
  seedAttendance,
  seedPreparation,
  seedTrainingSession,
  setAuthCookie,
} from "./fixtures/auth";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CONSENT_BANNER_WAIT_MS = 5_000;
const THEMES = ["light", "dark"] as const;
const SCREENSHOT_DIR = process.env.TS_SCREENSHOT_DIR;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** An explicit week around the seeded TS keeps the test green on the first days of a semester. */
async function openStats(page: Page, opts: { explicitRange?: boolean } = {}): Promise<void> {
  const from = dateKey(new Date(Date.now() - 7 * DAY_MS));
  const to = dateKey(new Date(Date.now() + DAY_MS));
  await page.goto(opts.explicitRange ? `/ts/statistiky?from=${from}&to=${to}` : "/ts/statistiky");
  // The consent banner appears after hydration and covers the lower part of the page.
  const decline = page.getByRole("button", { name: "Odmítnout" });
  await decline
    .waitFor({ state: "visible", timeout: CONSENT_BANNER_WAIT_MS })
    .then(() => decline.click())
    .catch(() => {});
}

test.describe("TS statistiky", () => {
  test.describe.configure({ mode: "serial" });

  let cookie: string;

  test.beforeAll(async () => {
    const teamId = await createTestTeam();
    const user = await getSetupSessionCookie(teamId);
    const teammate = await getSetupSessionCookie(teamId);
    await grantBetaAccess(user.profileId);
    cookie = user.cookie;

    // Two past TS this semester (yesterday and 2 days ago keep them inside the default period).
    const firstStart = new Date(Date.now() - DAY_MS);
    const { sessionId: prepared } = await seedTrainingSession(teamId, user.profileId, {
      startsAt: firstStart.toISOString(),
      endsAt: new Date(firstStart.getTime() + 2 * HOUR_MS).toISOString(),
      facilitate: true,
    });
    await seedPreparation(prepared, user.profileId, new Date(firstStart.getTime() - 2 * DAY_MS).toISOString());
    await seedAttendance(prepared, user.profileId, "present", user.profileId);

    const secondStart = new Date(Date.now() - 2 * DAY_MS);
    await seedTrainingSession(teamId, teammate.profileId, {
      startsAt: secondStart.toISOString(),
      endsAt: new Date(secondStart.getTime() + 2 * HOUR_MS).toISOString(),
    });
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookie);
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("shows facilitation, příprava lead time and attendance gaps", async ({ page }) => {
    await openStats(page, { explicitRange: true });

    await expect(page.getByRole("link", { name: "Statistiky" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Facilitace" })).toBeVisible();
    await expect(page.getByText("V průměru 2 dny předem")).toBeVisible();
    await expect(page.getByText("1 TS bez vyplněné docházky")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Stáhnout Počet facilitací jako CSV" }).click();
    expect((await download).suggestedFilename()).toMatch(/pocet-facilitaci\.csv$/);

    if (SCREENSHOT_DIR) {
      for (const theme of THEMES) {
        await page.evaluate((t) => localStorage.setItem("theme", t), theme);
        await page.reload();
        await page.waitForLoadState("networkidle");
        const sections = page.locator("main section[aria-labelledby^='ts-stats-']");
        for (let index = 0; index < (await sections.count()); index += 1) {
          await sections.nth(index).screenshot({ path: `${SCREENSHOT_DIR}/ts-stats-${theme}-${index}.png` });
        }
      }
    }
  });

  test("keeps 'this week' selected and can return to the semester", async ({ page }) => {
    await openStats(page);
    await page.getByRole("button", { name: /^Období:/ }).click();
    await page.getByRole("button", { name: "Tento týden" }).click();

    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}/);
    await expect(page.getByRole("button", { name: /^Období: Tento týden/ })).toBeVisible();

    // And back to the default: the semester preset drops the params again.
    await page.getByRole("button", { name: /^Období:/ }).click();
    await page.getByRole("button", { name: "Tento semestr" }).click();
    await expect(page).not.toHaveURL(/from=/);
    await expect(page.getByRole("button", { name: /^Období: Tento semestr/ })).toBeVisible();
  });
});
