import { expect, test } from "@playwright/test";

import {
  cleanupTestData,
  getSetupSessionCookie,
  seedRoom,
  setAuthCookie,
} from "./fixtures/auth";

/** YYYY-MM-DD for a day `daysAhead` from now, in the app's timezone. */
function pragueDateString(daysAhead: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000));
}

test.describe("reservations", () => {
  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("books the same time in two rooms and warns about the overlap", async ({
    browser,
  }) => {
    const user = await getSetupSessionCookie();
    const firstRoom = await seedRoom(user.profileId);
    const secondRoom = await seedRoom(user.profileId);

    const context = await browser.newContext();
    await setAuthCookie(context, user.cookie);
    const page = await context.newPage();

    // 10:00 with a +01:00 offset stays inside operating hours in both CET and
    // CEST (10:00 or 11:00 Prague time).
    const date = pragueDateString(7);
    const payload = (roomId: string) => ({
      room_id: roomId,
      title: "E2E parallel booking",
      person_count: 4,
      start_at: `${date}T10:00:00+01:00`,
      end_at: `${date}T11:00:00+01:00`,
    });

    const first = await page.request.post("/api/reservations", {
      data: payload(firstRoom.roomId),
    });
    expect(first.status()).toBe(200);
    expect(
      ((await first.json()) as { warning?: unknown }).warning,
    ).toBeUndefined();

    const second = await page.request.post("/api/reservations", {
      data: payload(secondRoom.roomId),
    });
    expect(second.status()).toBe(200);

    const body = (await second.json()) as {
      warning?: {
        code: string;
        reservations: { id: string; title: string; room_name: string | null }[];
      };
    };
    expect(body.warning?.code).toBe("OWN_RESERVATIONS_OVERLAP");
    expect(body.warning?.reservations).toEqual([
      expect.objectContaining({ room_name: firstRoom.name }),
    ]);

    await context.close();
  });
});
