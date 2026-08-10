import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  getSetupSessionCookie,
  setAuthCookie,
} from "./fixtures/auth";

// One title per test: the three tests share a profile, and a draft left behind
// by an earlier test would make a title-based locator ambiguous.
const RELOAD_TITLE = "E2E koncept — reload";
const PUBLISH_TITLE = "E2E koncept — zveřejnění";
const HISTORY_TITLE = "E2E koncept — historie";
const DELETE_TITLE = "E2E koncept — smazání";
const DRAFT_BODY = "Tohle je text, který musí přežít reload stránky.";

test.describe("essay autosave and koncepty", () => {
  let cookieValue: string;

  test.beforeAll(async () => {
    const { cookie } = await getSetupSessionCookie();
    cookieValue = cookie;
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("autosaves a new essay as a koncept and survives a reload", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);
    await page.goto("/cteni/eseje/nova");

    await page.getByLabel("Název eseje").fill(RELOAD_TITLE);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(DRAFT_BODY);

    // The URL swaps to the editor route once the koncept row exists.
    await expect(page).toHaveURL(/\/cteni\/eseje\/[0-9a-f-]{36}\/upravit$/, { timeout: 15_000 });
    await expect(page.getByText(/Uloženo/)).toBeVisible({ timeout: 15_000 });

    const editorUrl = page.url();
    await page.reload();

    await expect(page.getByLabel("Název eseje")).toHaveValue(RELOAD_TITLE);
    await expect(page.locator(".ProseMirror")).toContainText(DRAFT_BODY);
    expect(page.url()).toBe(editorUrl);
  });

  test("a koncept appears under Koncepty and disappears once published", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);
    await page.goto("/cteni/eseje/nova");

    await page.getByLabel("Název eseje").fill(PUBLISH_TITLE);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(DRAFT_BODY);
    await expect(page).toHaveURL(/\/upravit$/, { timeout: 15_000 });
    await expect(page.getByText(/Uloženo/)).toBeVisible({ timeout: 15_000 });

    await page.goto("/cteni/prehled");
    await expect(page.getByText(/Koncepty \(/)).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(PUBLISH_TITLE) })).toBeVisible();

    await page.getByRole("link", { name: new RegExp(PUBLISH_TITLE) }).click();
    await page.getByRole("button", { name: "Zveřejnit" }).click();

    await expect(page).toHaveURL(/\/cteni\/eseje\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: PUBLISH_TITLE })).toBeVisible();
    const essayId = new URL(page.url()).pathname.split("/").at(-1);

    // Asserted per essay rather than on the whole Koncepty group: the other
    // tests in this file leave their own drafts on the same profile.
    await page.goto("/cteni/prehled");
    await expect(
      page.locator(`a[href="/cteni/eseje/${essayId}/upravit"]`),
    ).toHaveCount(0);
  });

  test("history lists at least the current version", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);
    await page.goto("/cteni/eseje/nova");

    await page.getByLabel("Název eseje").fill(HISTORY_TITLE);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(DRAFT_BODY);
    await expect(page).toHaveURL(/\/upravit$/, { timeout: 15_000 });
    await expect(page.getByText(/Uloženo/)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Další akce" }).click();
    await page.getByRole("menuitem", { name: "Historie verzí" }).click();
    const history = page.getByRole("dialog");
    await expect(history.getByText("Historie verzí")).toBeVisible();
    // Scoped to the sheet: the editor footer also reports a word count.
    await expect(history.getByText(/slov/).first()).toBeVisible();
  });

  test("deletes a koncept and takes it out of the list", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);
    await page.goto("/cteni/eseje/nova");

    await page.getByLabel("Název eseje").fill(DELETE_TITLE);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(DRAFT_BODY);
    await expect(page).toHaveURL(/\/upravit$/, { timeout: 15_000 });
    await expect(page.getByText(/Uloženo/)).toBeVisible({ timeout: 15_000 });
    const essayId = new URL(page.url()).pathname.split("/").at(-2);

    await page.getByRole("button", { name: "Další akce" }).click();
    await page.getByRole("menuitem", { name: "Smazat koncept" }).click();
    await expect(page.getByText("Smazat koncept?")).toBeVisible();
    await page.getByRole("button", { name: "Smazat", exact: true }).click();

    await expect(page).toHaveURL(/\/cteni\/prehled$/, { timeout: 15_000 });
    await expect(page.locator(`a[href="/cteni/eseje/${essayId}/upravit"]`)).toHaveCount(0);

    // The author can no longer reach it.
    await page.goto(`/cteni/eseje/${essayId}/upravit`);
    await expect(page.getByLabel("Název eseje")).toHaveCount(0);

    // Soft, not gone: the row is still there with removed_at stamped, which is
    // what lets an admin recover it and keeps the revisions intact.
    const rows = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/essays` +
        `?id=eq.${essayId}&select=id,removed_at`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    ).then((res) => res.json());

    expect(rows).toHaveLength(1);
    expect(rows[0].removed_at).not.toBeNull();
  });
});