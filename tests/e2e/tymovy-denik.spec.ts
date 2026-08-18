import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  grantBetaAccess,
  setAuthCookie,
} from "./fixtures/auth";

test.describe("týmový deník - unauthenticated", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/tymovy-denik");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe("týmový deník - single user", () => {
  let cookieValue: string;

  test.beforeAll(async () => {
    const teamId = await createTestTeam();
    const user = await getSetupSessionCookie(teamId);
    await grantBetaAccess(user.profileId);
    cookieValue = user.cookie;
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookieValue);
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("list page shows empty state", async ({ page }) => {
    await page.goto("/tymovy-denik");
    await expect(page.getByRole("heading", { name: "Týmový deník" })).toBeVisible();
    await expect(page.getByText("Žádné akce")).toBeVisible();
  });

  test("creating an activity adds it to the feed", async ({ page }) => {
    // Unique per run — the info card below the header literally contains
    // "Cabin in the Woods", so the assertion must target a unique string.
    const activityType = `E2E akce ${Date.now()}`;
    await page.goto("/tymovy-denik");
    await page.getByRole("button", { name: /Nová akce/i }).click();
    await page.getByLabel("Typ akce").fill(activityType);
    await page.getByLabel("Účast").fill("Celý tým");
    await page.getByLabel("Proč jsme tam byli").fill("Teambuilding");
    await page.getByLabel(/Co jsme si odnesli/).fill("Silnější vazby");
    // Scope to the dialog: the empty-state also renders a "Přidat akci" trigger.
    await page.getByRole("dialog").getByRole("button", { name: "Přidat akci" }).click();

    // Wait for the dialog to unmount — until then, getByText also matches the
    // form fields' values inside it (e.g. the "Teambuilding" textarea).
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(activityType)).toBeVisible();
    await expect(page.getByText("Teambuilding")).toBeVisible();
  });

  test("deleting an activity removes it from the feed", async ({ page }) => {
    const activityType = `E2E smazat ${Date.now()}`;
    await page.goto("/tymovy-denik");
    await page.getByRole("button", { name: /Nová akce/i }).click();
    await page.getByLabel("Typ akce").fill(activityType);
    await page.getByRole("dialog").getByRole("button", { name: "Přidat akci" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(activityType)).toBeVisible();

    await page.getByRole("button", { name: /Smazat/i }).click();
    await page.getByRole("button", { name: "Odstranit" }).click();
    await expect(page.getByText(activityType)).toHaveCount(0);
  });
});
