import { expect, test } from "@playwright/test";

import { SYNC_SESSION_COLUMNS } from "@/lib/training-sessions/calendar-sync-events";

import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  grantBetaAccess,
  seedTeamCalendar,
  seedTrainingSession,
  selectRows,
  setAuthCookie,
} from "./fixtures/auth";

const THEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;
const SCREENSHOT_DIR = process.env.TS_SCREENSHOT_DIR;
const DAY_MS = 24 * 60 * 60 * 1000;

test.describe("Google Kalendář týmu settings", () => {
  test.describe.configure({ mode: "serial" });
  let unconnectedCookie: string;
  let connectedCookie: string;
  let connectedSessionId: string;

  test.beforeAll(async () => {
    const freeTeam = await createTestTeam();
    const free = await getSetupSessionCookie(freeTeam);
    await grantBetaAccess(free.profileId);
    unconnectedCookie = free.cookie;

    const connectedTeam = await createTestTeam();
    const connected = await getSetupSessionCookie(connectedTeam);
    await grantBetaAccess(connected.profileId);
    connectedCookie = connected.cookie;
    const startsAt = new Date(Date.now() + 2 * DAY_MS).toISOString();
    const { sessionId } = await seedTrainingSession(connectedTeam, connected.profileId, {
      facilitate: true,
      startsAt,
      endsAt: new Date(Date.parse(startsAt) + 3 * 60 * 60 * 1000).toISOString(),
      topic: "Vyjednávání",
    });
    connectedSessionId = sessionId;
    await seedTeamCalendar(connectedTeam, {
      calendarName: "Tým E2E",
      failedSessionId: sessionId,
      errorMessage: "Google Kalendář je teď nedostupný. Zkus to prosím znovu.",
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  // Regression: the sync's session query once failed with PGRST201 (ambiguous profiles embed),
  // so every sync was silently skipped. Run the exact query against the real database.
  test("the sync's session query loads a TS with its facilitators", async () => {
    const rows = (await selectRows("training_sessions", SYNC_SESSION_COLUMNS, `id=eq.${connectedSessionId}`)) as {
      topic: string;
      facilitators: { profile: { name: string | null } | null }[];
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].topic).toBe("Vyjednávání");
    expect(rows[0].facilitators).toHaveLength(1);
  });

  test("a team member finds the section in the hub and sees the connect steps", async ({ page, context }) => {
    await setAuthCookie(context, unconnectedCookie);
    await page.goto("/settings");
    await page.getByRole("navigation", { name: "Nastavení" }).getByRole("link", { name: /Google Kalendář týmu/ }).click();
    await expect(page).toHaveURL(/\/settings\/ts$/);
    await expect(page.getByRole("heading", { name: "Propoj kalendář týmu" })).toBeVisible();
    await expect(page.getByLabel("ID kalendáře")).toBeVisible();
    await expect(page.getByRole("button", { name: "Propojit" })).toBeVisible();
  });

  test("a connected team sees its calendar and failed syncs", async ({ page, context }) => {
    await setAuthCookie(context, connectedCookie);
    await page.goto("/settings/ts");
    await expect(page.getByText("Tým E2E")).toBeVisible();
    await expect(page.getByText("Vyjednávání")).toBeVisible();
    await expect(page.getByRole("button", { name: "Zkusit znovu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Odpojit" })).toBeVisible();
  });

  test("screenshots for visual review", async ({ page, context }) => {
    test.skip(!SCREENSHOT_DIR, "set TS_SCREENSHOT_DIR to capture");
    for (const [state, cookie] of [["unconnected", unconnectedCookie], ["connected", connectedCookie]] as const) {
      await context.clearCookies();
      await setAuthCookie(context, cookie);
      for (const theme of THEMES) {
        await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.goto("/settings/ts");
          await page.waitForLoadState("networkidle");
          const decline = page.getByRole("button", { name: "Odmítnout" });
          if (await decline.isVisible().catch(() => false)) await decline.click();
          await page.screenshot({ path: `${SCREENSHOT_DIR}/${state}-${theme}-${viewport.name}.png`, fullPage: true });
        }
      }
    }
  });
});
