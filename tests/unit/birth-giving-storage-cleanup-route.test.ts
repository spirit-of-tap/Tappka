import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cleanupBirthGivingStorage: vi.fn() }));

vi.mock("@/lib/birth-giving/storage-cleanup", () => ({
  cleanupBirthGivingStorage: mocks.cleanupBirthGivingStorage,
}));

import { GET, POST } from "@/app/api/system/birth-giving/cleanup-storage/route";

const VERCEL_CONFIG_PATH = fileURLToPath(new URL("../../vercel.json", import.meta.url));

describe("Birth Giving storage cleanup route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "configured-secret";
    mocks.cleanupBirthGivingStorage.mockResolvedValue({ claimed: 2, deleted: 1, failed: 1 });
  });

  it("does not run cleanup for an incorrect secret", async () => {
    const response = await POST(new Request("http://localhost", {
      headers: { authorization: "Bearer wrong-secret" },
      method: "POST",
    }) as never);

    expect(response.status).toBe(401);
    expect(mocks.cleanupBirthGivingStorage).not.toHaveBeenCalled();
  });

  it("returns cleanup counts for the configured secret", async () => {
    const response = await POST(new Request("http://localhost", {
      headers: { authorization: "Bearer configured-secret" },
      method: "POST",
    }) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { claimed: 2, deleted: 1, failed: 1 } });
  });

  it("accepts Vercel cron GET requests with the configured bearer secret", async () => {
    const response = await GET(new Request("http://localhost", {
      headers: { authorization: "Bearer configured-secret" },
    }) as never);

    expect(response.status).toBe(200);
    expect(mocks.cleanupBirthGivingStorage).toHaveBeenCalledOnce();
  });

  it("fails closed for GET requests when CRON_SECRET is absent", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(new Request("http://localhost", {
      headers: { authorization: "Bearer configured-secret" },
    }) as never);

    expect(response.status).toBe(401);
    expect(mocks.cleanupBirthGivingStorage).not.toHaveBeenCalled();
  });

  it("schedules the cleanup GET route daily in Vercel", () => {
    const config = JSON.parse(readFileSync(VERCEL_CONFIG_PATH, "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };

    expect(config.crons).toContainEqual({
      path: "/api/system/birth-giving/cleanup-storage",
      schedule: "0 3 * * *",
    });
  });
});
