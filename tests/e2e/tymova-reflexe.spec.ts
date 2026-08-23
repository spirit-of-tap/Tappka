import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  grantBetaAccess,
  seedTeamReflection,
  setAuthCookie,
} from "./fixtures/auth";

function uniqueMonth(): string {
  const seed = Date.now();
  const year = 1990 + (seed % 30);
  const month = String((seed % 12) + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

test.describe("týmová reflexe - unauthenticated", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/tymova-reflexe");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe("týmová reflexe - single user", () => {
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

  test("list page shows the month calendar", async ({ page }) => {
    const response = await page.goto("/tymova-reflexe");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Týmová reflexe" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kalendář reflexí" })).toBeVisible();
  });

  test("creating a reflection redirects to its detail page", async ({ page }) => {
    await page.goto(`/tymova-reflexe/nova?month=${uniqueMonth()}`);
    await page.getByRole("button", { name: /Vytvořit reflexi za/i }).click();
    await page.waitForURL(/\/tymova-reflexe\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: /Týmová reflexe/i })).toBeVisible();
  });

  test("editing a field autosaves", async ({ page }) => {
    await page.goto(`/tymova-reflexe/nova?month=${uniqueMonth()}`);
    await page.getByRole("button", { name: /Vytvořit reflexi za/i }).click();
    await page.waitForURL(/\/tymova-reflexe\/[0-9a-f-]+$/);

    const unique = `E2E edit ${Date.now()}`;
    await page.getByLabel("Co se nepovedlo").fill(unique);
    await expect(page.getByText("Neuložené změny")).toBeVisible();
    // exact: true matters — "Uloženo" is a case-insensitive substring of "Neuloženo",
    // so a loose match would resolve immediately on the transient unsaved state.
    await expect(page.getByText("Uloženo", { exact: true })).toBeVisible({ timeout: 5000 });

    await page.reload();
    await expect(page.getByLabel("Co se nepovedlo")).toHaveValue(unique);
  });

  test("visiting /nova for a month that already has a reflection redirects to it instead of showing a raw DB error", async ({ page }) => {
    const month = uniqueMonth();

    await page.goto(`/tymova-reflexe/nova?month=${month}`);
    await page.getByRole("button", { name: /Vytvořit reflexi za/i }).click();
    await page.waitForURL(/\/tymova-reflexe\/[0-9a-f-]+$/);
    const firstUrl = page.url();

    // Second visit to the same month — the create page's own server-side check
    // now redirects straight there instead of ever showing the create button.
    await page.goto(`/tymova-reflexe/nova?month=${month}`);
    await expect(page).toHaveURL(firstUrl);
    await expect(page.getByText("duplicate key value", { exact: false })).toHaveCount(0);
  });

  test("deleting a reflection and creating a new one for the same month works", async ({ page }) => {
    const month = uniqueMonth();

    await page.goto(`/tymova-reflexe/nova?month=${month}`);
    await page.getByRole("button", { name: /Vytvořit reflexi za/i }).click();
    await page.waitForURL(/\/tymova-reflexe\/[0-9a-f-]+$/);
    const firstId = page.url().split("/").pop();

    await page.goto("/tymova-reflexe");
    const card = page.locator(`a[href="/tymova-reflexe/${firstId}"]`).locator("xpath=..");
    await card.getByRole("button", { name: /Smazat/i }).click();
    await page.getByRole("button", { name: "Odstranit" }).click();
    await expect(page.locator(`a[href="/tymova-reflexe/${firstId}"]`)).toHaveCount(0);

    // The row is soft-deleted (removed_at set), not gone — a plain unique
    // index on (team_id, month) would still block a new insert for this
    // month. The index must be partial (WHERE removed_at IS NULL) for this
    // to succeed instead of surfacing a raw 23505 duplicate-key error.
    await page.goto(`/tymova-reflexe/nova?month=${month}`);
    await page.getByRole("button", { name: /Vytvořit reflexi za/i }).click();
    await page.waitForURL(/\/tymova-reflexe\/[0-9a-f-]+$/);
    const secondId = page.url().split("/").pop();

    expect(secondId).not.toBe(firstId);
    await expect(page.getByText("duplicate key value", { exact: false })).toHaveCount(0);
  });
});

test.describe("ročník v kalendáři", () => {
  test("derives ročník from the team's onboarding year and shows it per school year", async ({ page, context }) => {
    // Mirror the app's own school-year boundary (Sept start) instead of
    // assuming today's month, so this test stays correct year-round.
    const now = new Date();
    const currentSchoolYearStart = now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    const onboardingYear = currentSchoolYearStart - 1; // makes the current school year the team's 2nd

    const teamId = await createTestTeam(onboardingYear);
    const user = await getSetupSessionCookie(teamId);
    await grantBetaAccess(user.profileId);
    await setAuthCookie(context, user.cookie);

    await page.goto("/tymova-reflexe");

    // Ročník is the primary label (calendar years are secondary detail), and
    // all 3 ročníky of the fixed program show up as a roadmap — including
    // ročník 3, which is still entirely in the future for this team.
    await expect(page.getByText("1. ročník")).toBeVisible();
    await expect(page.getByText("2. ročník")).toBeVisible();
    await expect(page.getByText("3. ročník")).toBeVisible();

    const yearSections = page.getByRole("button").filter({ hasText: /ročník/ });
    await expect(yearSections).toHaveCount(3);

    // Ascending order (1 → 2 → 3), not the old newest-first ordering that
    // made pre-existence/older years read as if they came "after" ročník 1.
    await expect(yearSections.nth(0)).toContainText("1. ročník");
    await expect(yearSections.nth(2)).toContainText("3. ročník");
  });
});

test.describe("semestrální reflexe", () => {
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

  test("creating a semester reflection shows all topics and autosaves a field", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") pageErrors.push(msg.text());
    });

    await page.goto("/tymova-reflexe/semestralni/nova?semester=2026-01-01");
    await page.getByRole("button", { name: /Založit reflexi/i }).click();
    await page.waitForURL(/\/tymova-reflexe\/semestralni\/[0-9a-f-]+$/);

    await expect(page.getByRole("heading", { name: /Semestrální reflexe/i })).toBeVisible();

    await page.getByRole("button", { name: /Předměty, zkoušky, vyučující/i }).click();
    const unique = `E2E semester ${Date.now()}`;
    await page.getByLabel("Co se povedlo").first().fill(unique);
    await expect(page.getByText("Uloženo", { exact: true })).toBeVisible({ timeout: 5000 });

    await page.reload();
    await page.getByRole("button", { name: /Předměty, zkoušky, vyučující/i }).click();
    await expect(page.getByLabel("Co se povedlo").first()).toHaveValue(unique);

    await page.goto("/tymova-reflexe");
    await expect(page.getByText("Zimní semestr 2026")).toBeVisible();
    await expect(page.getByText("1/11 témat vyplněno")).toBeVisible();

    // Regression guard: a card wrapped in <Link> with a nested <Link>-as-button
    // inside it renders <a> inside <a>, which React only complains about via
    // console error / hydration mismatch — no functional assertion above would
    // have caught it, so check explicitly.
    const hydrationErrors = pageErrors.filter((e) => /hydrat|cannot (be a descendant|contain)/i.test(e));
    expect(hydrationErrors).toEqual([]);
  });

  test("deleting a semester reflection and creating a new one for the same period works", async ({ page }) => {
    // Different year from the test above so the two don't collide on the same team.
    await page.goto("/tymova-reflexe/semestralni/nova?semester=2027-01-01");
    await page.getByRole("button", { name: /Založit reflexi/i }).click();
    await page.waitForURL(/\/tymova-reflexe\/semestralni\/[0-9a-f-]+$/);
    const firstId = page.url().split("/").pop();

    await page.goto("/tymova-reflexe");
    const card = page.locator(`a[href="/tymova-reflexe/semestralni/${firstId}"]`).locator("xpath=..");
    await card.getByRole("button", { name: /Smazat/i }).click();
    await page.getByRole("button", { name: "Odstranit" }).click();
    await expect(page.locator(`a[href="/tymova-reflexe/semestralni/${firstId}"]`)).toHaveCount(0);

    await page.goto("/tymova-reflexe/semestralni/nova?semester=2027-01-01");
    await page.getByRole("button", { name: /Založit reflexi/i }).click();
    await page.waitForURL(/\/tymova-reflexe\/semestralni\/[0-9a-f-]+$/);
    const secondId = page.url().split("/").pop();

    expect(secondId).not.toBe(firstId);
    await expect(page.getByText("duplicate key value", { exact: false })).toHaveCount(0);
  });
});

test.describe("týmová reflexe - concurrent editing", () => {
  test("a teammate's save does not wipe out another user's in-progress edit on a different field", async ({ browser }) => {
    const teamId = await createTestTeam();
    const userA = await getSetupSessionCookie(teamId);
    const userB = await getSetupSessionCookie(teamId);
    await grantBetaAccess(userA.profileId);
    await grantBetaAccess(userB.profileId);

    const { reflectionId } = await seedTeamReflection(teamId, userA.profileId, uniqueMonth());

    const contextA = await browser.newContext();
    await setAuthCookie(contextA, userA.cookie);
    const pageA = await contextA.newPage();

    const contextB = await browser.newContext();
    await setAuthCookie(contextB, userB.cookie);
    const pageB = await contextB.newPage();

    try {
      await pageA.goto(`/tymova-reflexe/${reflectionId}`);
      await pageB.goto(`/tymova-reflexe/${reflectionId}`);

      const inProgressText = "A je uprostřed psaní této věty";
      await pageA.getByLabel("Co se povedlo").fill(inProgressText);

      // B edits a different field and lets it fully save+broadcast while A is still mid-edit.
      await pageB.getByLabel("Zodpovědná osoba za AK").fill("Karel");
      await expect(pageB.getByText("Uloženo", { exact: true })).toBeVisible({ timeout: 5000 });

      // Give the broadcast a moment to reach A, then confirm A's in-progress text survived.
      await pageA.waitForTimeout(1000);
      await expect(pageA.getByLabel("Co se povedlo")).toHaveValue(inProgressText);

      // Let A's own autosave complete too.
      await expect(pageA.getByText("Uloženo", { exact: true })).toBeVisible({ timeout: 5000 });

      // Reload B and confirm both edits persisted — no data loss either direction.
      await pageB.reload();
      await expect(pageB.getByLabel("Co se povedlo")).toHaveValue(inProgressText);
      await expect(pageB.getByLabel("Zodpovědná osoba za AK")).toHaveValue("Karel");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});

test.afterAll(async () => {
  await cleanupTestData();
});
