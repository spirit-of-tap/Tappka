import { expect, test } from "@playwright/test";

import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  grantBetaAccess,
  seedPreparation,
  seedTrainingSession,
  setAuthCookie,
  setProfileRole,
} from "./fixtures/auth";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

test.describe("TS příprava: admin can edit any session", () => {
  test.describe.configure({ mode: "serial" });
  let sessionId: string;
  let adminCookie: string;
  let studentCookie: string;

  test.beforeAll(async () => {
    const hostTeam = await createTestTeam();
    const host = await getSetupSessionCookie(hostTeam);
    await grantBetaAccess(host.profileId);
    const startsAt = new Date(Date.now() + 2 * DAY_MS).toISOString();
    ({ sessionId } = await seedTrainingSession(hostTeam, host.profileId, {
      startsAt,
      endsAt: new Date(Date.parse(startsAt) + 3 * HOUR_MS).toISOString(),
      topic: "Vyjednávání",
      facilitate: true,
    }));
    await seedPreparation(sessionId, host.profileId, new Date().toISOString());

    const otherTeam = await createTestTeam();
    const admin = await getSetupSessionCookie(otherTeam);
    await grantBetaAccess(admin.profileId);
    await setProfileRole(admin.profileId, "admin");
    adminCookie = admin.cookie;

    const student = await getSetupSessionCookie(otherTeam);
    await grantBetaAccess(student.profileId);
    studentCookie = student.cookie;
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("an admin from another team gets the editor", async ({ page, context }) => {
    await setAuthCookie(context, adminCookie);
    await page.goto(`/ts/${sessionId}`);
    await expect(page.getByRole("button", { name: "Uložit" })).toBeVisible();

    // Saving goes through the admin branch of the API guard and the admin RLS policies.
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Doplnil:a admin" }] }] };
    const response = await page.request.put(`/api/training-sessions/${sessionId}/preparation`, { data: { contentJson: doc } });
    expect(response.status()).toBe(200);
    await page.reload();
    await expect(page.getByText("Doplnil:a admin")).toBeVisible();
  });

  test("a student from another team cannot save through the API either", async ({ page, context }) => {
    await setAuthCookie(context, studentCookie);
    await page.goto(`/ts/${sessionId}`);
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] };
    const response = await page.request.put(`/api/training-sessions/${sessionId}/preparation`, { data: { contentJson: doc } });
    expect(response.status()).toBe(403);
  });

  test("a student from another team only reads it", async ({ page, context }) => {
    await setAuthCookie(context, studentCookie);
    await page.goto(`/ts/${sessionId}`);
    await expect(page.getByRole("heading", { name: "Vyjednávání" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Uložit" })).toHaveCount(0);
  });
});
