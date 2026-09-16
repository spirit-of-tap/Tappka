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

test.describe("rocket model - unauthenticated", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/rocket-model");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe("rocket model - single user", () => {
  let cookieValue: string;

  test.beforeAll(async () => {
    // Rocket Model is gated to team Tuuli (plus admins) — the E2E team takes that name.
    const teamId = await createTestTeam(undefined, "Tuuli");
    const user = await getSetupSessionCookie(teamId);
    await grantBetaAccess(user.profileId);
    await setBetaCohort(user.profileId, "B");
    cookieValue = user.cookie;
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookieValue);
  });

  test("shows seeded categories and persists an individual check", async ({ page }) => {
    await page.goto("/rocket-model");
    await expect(page.getByRole("heading", { name: "Rocket Model" })).toBeVisible();
    await expect(page.getByText("Y1 - The process of Individual Learning")).toBeVisible();

    const box = page.getByRole("checkbox", { name: FIRST_ITEM }).first();
    if (!(await box.isChecked())) {
      await box.click();
    }
    await expect(box).toBeChecked();

    await page.reload();
    await expect(page.getByRole("checkbox", { name: FIRST_ITEM }).first()).toBeChecked();
  });

  test("unlocks the team check on unanimity and persists it", async ({ page }) => {
    await page.goto("/rocket-model");

    const ownBox = page.getByRole("checkbox", { name: FIRST_ITEM }).first();
    if (!(await ownBox.isChecked())) {
      await ownBox.click();
    }
    await expect(ownBox).toBeChecked();

    await page.getByRole("tab", { name: /Týmový přehled/ }).click();
    const teamBox = page.getByRole("checkbox", { name: FIRST_ITEM });
    // Single-member team: one individual check is already unanimous.
    await expect(teamBox).toBeEnabled();
    if (!(await teamBox.isChecked())) {
      await teamBox.click();
    }
    await expect(teamBox).toBeChecked();

    await page.reload();
    await page.getByRole("tab", { name: /Týmový přehled/ }).click();
    await expect(page.getByRole("checkbox", { name: FIRST_ITEM })).toBeChecked();

    const teamPanel = page.getByRole("tabpanel", { name: /Týmový přehled/ });
    const firstItemGroup = teamPanel.getByRole("group", { name: FIRST_ITEM });
    await firstItemGroup.getByRole("button", { name: /Kdo a kdy/ }).click();
    await expect(firstItemGroup.getByText("E2E Test User")).toBeVisible();
    await expect(firstItemGroup.getByText(/Splněno \d{1,2}\. \d{1,2}\. \d{4}/)).toBeVisible();
  });
});

test.describe("rocket model - team gating", () => {
  let cookieValue: string;

  test.beforeAll(async () => {
    const teamId = await createTestTeam();
    const user = await getSetupSessionCookie(teamId);
    await grantBetaAccess(user.profileId);
    await setBetaCohort(user.profileId, "B");
    cookieValue = user.cookie;
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookieValue);
  });

  test("shows coming-soon for cohort B outside team Tuuli", async ({ page }) => {
    await page.goto("/rocket-model");
    await expect(page.getByText("V kuchyni se něco chystá")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rocket Model" })).not.toBeVisible();
  });
});

test.afterAll(async () => {
  await cleanupTestData();
});
