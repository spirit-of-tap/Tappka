import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  getSetupSessionCookie,
  setAuthCookie,
} from "./fixtures/auth";

// One title per test: the four tests share a profile, and an essay left
// behind by an earlier test would make a title-based locator ambiguous.
const RELOAD_TITLE = "E2E esej — reload";
const VISIBILITY_TITLE = "E2E esej — viditelnost";
const HISTORY_TITLE = "E2E esej — historie";
const DELETE_TITLE = "E2E esej — smazání";
const DRAFT_BODY = "Tohle je text, který musí přežít reload stránky.";

test.describe("essay autosave and auto-publish", () => {
  let cookieValue: string;

  test.beforeAll(async () => {
    const { cookie } = await getSetupSessionCookie();
    cookieValue = cookie;
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("autosaves a new essay and survives a reload", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);
    await page.goto("/cteni/eseje/nova");

    await page.getByLabel("Název eseje").fill(RELOAD_TITLE);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(DRAFT_BODY);

    // The URL swaps to the editor route once the essay row exists.
    await expect(page).toHaveURL(/\/cteni\/eseje\/[0-9a-f-]{36}\/upravit$/, { timeout: 15_000 });
    await expect(page.getByText(/Uloženo/)).toBeVisible({ timeout: 15_000 });

    const editorUrl = page.url();
    await page.reload();

    await expect(page.getByLabel("Název eseje")).toHaveValue(RELOAD_TITLE);
    await expect(page.locator(".ProseMirror")).toContainText(DRAFT_BODY);
    expect(page.url()).toBe(editorUrl);
  });

  test("an essay becomes visible in Moje eseje as soon as it gets a title — no publish step", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);
    await page.goto("/cteni/eseje/nova");

    // There is no publish button: filling in the title is the only thing
    // that makes the essay visible, and it happens through the ordinary
    // autosave flow.
    await expect(page.getByRole("button", { name: "Zveřejnit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Uložit změny" })).toHaveCount(0);

    await page.getByLabel("Název eseje").fill(VISIBILITY_TITLE);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(DRAFT_BODY);
    await expect(page).toHaveURL(/\/upravit$/, { timeout: 15_000 });
    await expect(page.getByText(/Uloženo/)).toBeVisible({ timeout: 15_000 });

    const essayId = new URL(page.url()).pathname.split("/").at(-2);

    await page.goto("/cteni/prehled");
    await expect(page.getByRole("link", { name: new RegExp(VISIBILITY_TITLE) })).toBeVisible();
    // Reading it directly (not via "continue editing") confirms it's a normal,
    // already-visible essay rather than something waiting on a further step.
    await expect(
      page.locator(`a[href="/cteni/eseje/${essayId}"]`),
    ).toHaveCount(1);
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

  test("deletes an essay and takes it out of the list", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);
    await page.goto("/cteni/eseje/nova");

    await page.getByLabel("Název eseje").fill(DELETE_TITLE);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(DRAFT_BODY);
    await expect(page).toHaveURL(/\/upravit$/, { timeout: 15_000 });
    await expect(page.getByText(/Uloženo/)).toBeVisible({ timeout: 15_000 });
    const essayId = new URL(page.url()).pathname.split("/").at(-2);

    // The title is already filled in, so the essay has been auto-published —
    // deleting it goes through the full ("Smazat esej", not the title-less
    // "Smazat rozepsanou esej") confirmation copy.
    await page.getByRole("button", { name: "Další akce" }).click();
    await page.getByRole("menuitem", { name: "Smazat esej" }).click();
    await expect(page.getByText("Smazat esej?")).toBeVisible();
    await page.getByRole("button", { name: "Smazat", exact: true }).click();

    await expect(page).toHaveURL(/\/cteni\/prehled$/, { timeout: 15_000 });
    await expect(page.locator(`a[href="/cteni/eseje/${essayId}"]`)).toHaveCount(0);

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