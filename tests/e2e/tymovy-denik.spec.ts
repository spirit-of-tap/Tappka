import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  grantBetaAccess,
  setAuthCookie,
} from "./fixtures/auth";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL7WAAAAABJRU5ErkJggg==",
  "base64",
);

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
    await page.getByLabel("Proč jsme tam byli").fill("Teambuilding");
    await page.getByLabel(/Co jsme si odnesli/).fill("Silnější vazby");
    // Scope to the dialog: the empty-state also renders a "Přidat akci" trigger.
    await page.getByRole("dialog").getByRole("button", { name: "Přidat akci" }).click();

    // Wait for the insert to settle — the dialog unmounts after save; asserting
    // it closed gives a clearer failure if the insert fails than racing the feed.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(activityType)).toBeVisible();
  });

  test("creating an activity stores and displays its photo", async ({ page }) => {
    const activityType = `E2E foto ${Date.now()}`;
    await page.goto("/tymovy-denik");
    await page.getByRole("button", { name: /Nová akce/i }).click();
    await page.getByLabel("Typ akce").fill(activityType);
    await page.locator("input[type=file]").setInputFiles({
      name: "activity.png",
      mimeType: "image/png",
      buffer: ONE_PIXEL_PNG,
    });
    await page.getByRole("dialog").getByRole("button", { name: "Přidat akci" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const entry = page.getByRole("link", { name: new RegExp(activityType) });
    const photo = entry.locator("img");
    await expect(photo).toBeVisible();
    await expect(photo).toHaveAttribute("src", /\/storage\/v1\/render\/image\/public\/images\/team-activities\//);
    await expect(photo).toHaveAttribute("srcset", /height=/);
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => (
      image.complete && image.naturalWidth > 0
    ))).toBe(true);

    await entry.click();
    const hero = page.locator("img[src*='/storage/v1/render/image/public/images/team-activities/']");
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute("srcset", /width=1600&height=900/);
    await expect.poll(() => hero.evaluate((image: HTMLImageElement) => (
      image.complete && image.naturalWidth > 0
    ))).toBe(true);

    // Delete through the product flow so the test leaves no Storage object behind.
    await page.getByRole("button", { name: "Další akce" }).click();
    await page.getByRole("menuitem", { name: "Smazat" }).click();
    await page.getByRole("button", { name: "Odstranit" }).click();
    await expect(page).toHaveURL(/\/tymovy-denik$/);
  });

  test("deleting an activity removes it from the feed", async ({ page }) => {
    const activityType = `E2E smazat ${Date.now()}`;
    await page.goto("/tymovy-denik");
    await page.getByRole("button", { name: /Nová akce/i }).click();
    await page.getByLabel("Typ akce").fill(activityType);
    await page.getByRole("dialog").getByRole("button", { name: "Přidat akci" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(activityType)).toBeVisible();

    await page.getByRole("link", { name: new RegExp(activityType) }).click();
    await page.getByRole("button", { name: "Další akce" }).click();
    await page.getByRole("menuitem", { name: "Smazat" }).click();
    await page.getByRole("button", { name: "Odstranit" }).click();

    await expect(page).toHaveURL(/\/tymovy-denik$/);
    await expect(page.getByText(activityType)).toHaveCount(0);
  });
});
