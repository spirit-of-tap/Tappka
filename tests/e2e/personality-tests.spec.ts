import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  setAuthCookie,
} from "./fixtures/auth";

const TEST_PDF = {
  name: "mbti-vysledky.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 test"),
};

async function uploadTest(page: import("@playwright/test").Page, typeLabel: string) {
  await page.getByRole("button", { name: /Nahrát test/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: typeLabel }).click();
  await dialog.getByLabel("Soubor s výsledky").setInputFiles(TEST_PDF);
  await dialog.getByRole("button", { name: "Nahrát test" }).click();
  await expect(dialog).toHaveCount(0);
}

async function uploadCustomTest(page: import("@playwright/test").Page, testName: string) {
  await page.getByRole("button", { name: /Nahrát test/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Jiný test" }).click();
  await dialog.getByLabel("Název testu").fill(testName);
  await dialog.getByLabel("Soubor s výsledky").setInputFiles(TEST_PDF);
  await dialog.getByRole("button", { name: "Nahrát test" }).click();
  await expect(dialog).toHaveCount(0);
}

async function deleteOnlyTest(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Smazat test" }).click();
  await page.getByRole("button", { name: "Odstranit" }).click();
  await expect(page.getByRole("button", { name: "Smazat test" })).toHaveCount(0);
}

test.describe("osobnostní testy - single user", () => {
  test.describe.configure({ mode: "serial" });

  let cookieValue: string;
  let profileId: string;

  test.beforeAll(async () => {
    const teamId = await createTestTeam();
    const user = await getSetupSessionCookie(teamId);
    cookieValue = user.cookie;
    profileId = user.profileId;
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookieValue);
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("profile shows empty state on the personality tests tab", async ({ page }) => {
    await page.goto(`/komunita/profil/${profileId}?tab=osobnostni-testy`);
    await expect(page.getByRole("tab", { name: /Osobnostní testy/ })).toBeVisible();
    await expect(page.getByText("Zatím nemáš nahraný žádný osobnostní test")).toBeVisible();
  });

  test("uploading a test adds it to the timeline", async ({ page }) => {
    const testName = `E2E test ${Date.now()}`;
    await page.goto(`/komunita/profil/${profileId}?tab=osobnostni-testy`);

    await page.getByRole("button", { name: /Nahrát test/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Jiný test" }).click();
    await dialog.getByLabel("Název testu").fill(testName);
    await dialog.getByLabel("Soubor s výsledky").setInputFiles(TEST_PDF);
    await dialog.getByRole("button", { name: "Nahrát test" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(testName)).toBeVisible();
    await expect(page.getByText("mbti-vysledky.pdf")).toBeVisible();

    await deleteOnlyTest(page);
  });

  test("editing a test changes its type", async ({ page }) => {
    const testName = `E2E uprava ${Date.now()}`;
    await page.goto(`/komunita/profil/${profileId}?tab=osobnostni-testy`);

    await page.getByRole("button", { name: /Nahrát test/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Jiný test" }).click();
    await dialog.getByLabel("Název testu").fill(testName);
    await dialog.getByLabel("Soubor s výsledky").setInputFiles(TEST_PDF);
    await dialog.getByRole("button", { name: "Nahrát test" }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "Upravit test" }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "DISC" }).click();
    await editDialog.getByRole("button", { name: "Uložit změny" }).click();

    await expect(editDialog).toHaveCount(0);
    await expect(page.getByText("DISC")).toBeVisible();
    await expect(page.getByText(testName)).toHaveCount(0);

    await deleteOnlyTest(page);
  });

  test("deleting a test removes it from the timeline", async ({ page }) => {
    const testName = `E2E smazat ${Date.now()}`;
    await page.goto(`/komunita/profil/${profileId}?tab=osobnostni-testy`);

    await uploadCustomTest(page, testName);
    await expect(page.getByText(testName)).toBeVisible();

    await page.getByRole("button", { name: "Smazat test" }).click();
    await page.getByRole("button", { name: "Odstranit" }).click();

    await expect(page.getByText(testName)).toHaveCount(0);
    await expect(page.getByText("Zatím nemáš nahraný žádný osobnostní test")).toBeVisible();
  });
});

test.describe("osobnostní testy - two users", () => {
  let ownerCookie: string;
  let ownerProfileId: string;
  let viewerCookie: string;

  test.beforeAll(async () => {
    const teamId = await createTestTeam();
    const owner = await getSetupSessionCookie(teamId);
    const viewer = await getSetupSessionCookie(teamId);
    ownerCookie = owner.cookie;
    ownerProfileId = owner.profileId;
    viewerCookie = viewer.cookie;
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("another verified user sees the test and can open the file", async ({ context, page }) => {
    const testName = `E2E sdileni ${Date.now()}`;

    await setAuthCookie(context, ownerCookie);
    await page.goto(`/komunita/profil/${ownerProfileId}?tab=osobnostni-testy`);
    await uploadCustomTest(page, testName);
    await expect(page.getByText(testName)).toBeVisible();

    await context.clearCookies();
    await setAuthCookie(context, viewerCookie);
    await page.goto(`/komunita/profil/${ownerProfileId}?tab=osobnostni-testy`);

    await expect(page.getByText(testName)).toBeVisible();
    await expect(page.getByText("mbti-vysledky.pdf")).toBeVisible();

    const popupPromise = page.waitForEvent("popup");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: /Otevřít/ }).click();
    const popup = await popupPromise;
    const download = await downloadPromise;
    await expect
      .poll(() => download.url(), { timeout: 15000 })
      .toMatch(/\/storage\/v1\/object\/sign\//);
    popup.close();
  });
});