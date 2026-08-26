import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ processBirthGiving: vi.fn() }));

vi.mock("@/lib/notifications/birth-giving-notifications", () => ({
  processBirthGiving: mocks.processBirthGiving,
}));

import * as route from "@/app/api/system/birth-giving/process/route";

const VERCEL_CONFIG_PATH = fileURLToPath(new URL("../../vercel.json", import.meta.url));

describe("Birth Giving combined process route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "configured-secret";
    mocks.processBirthGiving.mockResolvedValue({ sent: 2 });
  });

  it("exports only an authenticated GET handler", async () => {
    expect("POST" in route).toBe(false);
    const unauthorized = await route.GET(new Request("https://attacker.example/api/system/birth-giving/process"));
    expect(unauthorized.status).toBe(401);
    expect(mocks.processBirthGiving).not.toHaveBeenCalled();

    const authorized = await route.GET(new Request("https://attacker.example/api/system/birth-giving/process", {
      headers: { authorization: "Bearer configured-secret" },
    }));
    expect(authorized.status).toBe(200);
    expect(mocks.processBirthGiving).toHaveBeenCalledOnce();
    await expect(authorized.json()).resolves.toMatchObject({ data: { sent: 2 } });
  });

  it("fails closed when CRON_SECRET is absent", async () => {
    delete process.env.CRON_SECRET;
    const response = await route.GET(new Request("http://localhost", {
      headers: { authorization: "Bearer configured-secret" },
    }));
    expect(response.status).toBe(401);
  });

  it("schedules the combined processor daily within the Vercel Hobby cron limit", () => {
    const config = JSON.parse(readFileSync(VERCEL_CONFIG_PATH, "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };
    expect(config.crons).toContainEqual({
      path: "/api/system/birth-giving/process",
      schedule: "0 6 * * *",
    });
  });
});
