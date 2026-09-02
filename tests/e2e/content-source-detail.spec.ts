import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  getSetupSessionCookie,
  grantBetaAccess,
  setAuthCookie,
} from "./fixtures/auth";

const SOURCE_TITLE = "E2E Zdroj — detail stránka";
const ESSAY_TITLE = "E2E esej o zdroji";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function restFetch(path: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`REST ${method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

test.describe("content source detail page", () => {
  let cookieValue: string;
  let sourceId: string;
  let essayId: string;

  test.beforeAll(async () => {
    const { cookie, profileId } = await getSetupSessionCookie();
    cookieValue = cookie;
    await grantBetaAccess(profileId);

    const sources = (await restFetch("/content_sources", "POST", {
      kind: "podcast",
      title: SOURCE_TITLE,
      creator: "E2E Creator",
      points: 0.5,
      status: "approved",
      created_by_profile_id: profileId,
      updated_by_profile_id: profileId,
    })) as { id: string }[];
    sourceId = sources[0].id;

    const essays = (await restFetch("/essays", "POST", {
      author_profile_id: profileId,
      content_source_id: sourceId,
      published_at: new Date().toISOString(),
      created_by_profile_id: profileId,
      updated_by_profile_id: profileId,
    })) as { id: string }[];
    essayId = essays[0].id;

    await restFetch("/essay_revisions", "POST", {
      essay_id: essayId,
      revision_no: 1,
      title: ESSAY_TITLE,
      content_json: { type: "doc", content: [] },
      created_by_profile_id: profileId,
      updated_by_profile_id: profileId,
    });
  });

  test.afterAll(async () => {
    // essays/content_sources aren't covered by cleanupTestData()'s profile
    // teardown, and both created_by FKs are ON DELETE RESTRICT — leaving
    // these around would block deleting the test profile below.
    await restFetch(`/essays?id=eq.${essayId}`, "DELETE").catch(() => {});
    await restFetch(`/content_sources?id=eq.${sourceId}`, "DELETE").catch(() => {});
    await cleanupTestData();
  });

  test("shows source info and the essay written about it", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);
    await page.goto(`/cteni/zdroje/${sourceId}`);

    await expect(page.getByRole("heading", { name: SOURCE_TITLE })).toBeVisible();
    await expect(page.getByText("Podcast · E2E Creator")).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(ESSAY_TITLE) })).toBeVisible();
  });

  test("shows the not-found page for a nonexistent source id", async ({ page, context }) => {
    await setAuthCookie(context, cookieValue);
    await page.goto("/cteni/zdroje/00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });
});
