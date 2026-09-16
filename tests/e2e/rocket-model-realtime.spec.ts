import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  grantBetaAccess,
  setAuthCookie,
  setBetaCohort,
} from "./fixtures/auth";

const FIRST_ITEM = "Každý člen týmu si vede Learning Diary.";

/**
 * Live-propagation guard for the reported bug: a teammate's individual
 * check must appear in my team view without a reload (Supabase broadcast).
 */
test.describe("rocket model - realtime teammate updates", () => {
  let cookieA: string;
  let cookieB: string;

  test.beforeAll(async () => {
    // Same team, Tuuli-named so both pass the page gate.
    const teamId = await createTestTeam(undefined, "Tuuli");
    const userA = await getSetupSessionCookie(teamId);
    const userB = await getSetupSessionCookie(teamId);
    for (const u of [userA, userB]) {
      await grantBetaAccess(u.profileId);
      await setBetaCohort(u.profileId, "B");
    }
    cookieA = userA.cookie;
    cookieB = userB.cookie;
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("teammate individual check appears in team view without reload", async ({
    page,
    browser,
  }) => {
    await setAuthCookie(page.context(), cookieA);
    await page.goto("/rocket-model");
    await page.getByRole("tab", { name: /Týmový přehled/ }).click();
    const teamPanel = page.getByRole("tabpanel", { name: /Týmový přehled/ });
    // Subscribed and showing the untouched state.
    await expect(teamPanel.getByText("0/2").first()).toBeVisible();

    // Teammate B checks the item in a separate session (own realtime client).
    const ctxB = await browser.newContext();
    await setAuthCookie(ctxB, cookieB);
    const pageB = await ctxB.newPage();
    await pageB.goto("/rocket-model");
    const boxB = pageB.getByRole("checkbox", { name: FIRST_ITEM }).first();
    if (!(await boxB.isChecked())) {
      await boxB.click();
    }
    // Her save succeeded (otherwise no broadcast is ever sent).
    await expect(boxB).toBeChecked();

    // A sees it live — no reload: per-item counter flips 0/2 -> 1/2.
    await expect(teamPanel.getByText("1/2").first()).toBeVisible({
      timeout: 20_000,
    });

    await ctxB.close();
  });
});
