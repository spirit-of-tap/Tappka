import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cleanupBirthGivingStorage: vi.fn() }));

vi.mock("@/lib/birth-giving/storage-cleanup", () => ({
  cleanupBirthGivingStorage: mocks.cleanupBirthGivingStorage,
}));

import { POST } from "@/app/api/system/birth-giving/cleanup-storage/route";

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
});
