import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminRpc: vi.fn(),
  createAdminClient: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/storage/service", () => ({ deleteFile: mocks.deleteFile }));

import { cleanupBirthGivingStorage } from "./storage-cleanup";

describe("cleanupBirthGivingStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.adminRpc });
  });

  it("finalizes successful deletions and releases failed deletions", async () => {
    mocks.adminRpc
      .mockResolvedValueOnce({
        data: [
          { claim_id: "00000000-0000-4000-8000-000000000001", storage_path: "birth-giving/one.pdf" },
          { claim_id: "00000000-0000-4000-8000-000000000002", storage_path: "birth-giving/two.pdf" },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    mocks.deleteFile
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(cleanupBirthGivingStorage()).resolves.toEqual({ claimed: 2, deleted: 1, failed: 1 });
    expect(mocks.adminRpc).toHaveBeenNthCalledWith(2, "birth_giving_finalize_storage_cleanup", {
      p_claim_id: "00000000-0000-4000-8000-000000000001",
      p_storage_path: "birth-giving/one.pdf",
    });
    expect(mocks.adminRpc).toHaveBeenNthCalledWith(3, "birth_giving_release_storage_cleanup_claim", {
      p_claim_id: "00000000-0000-4000-8000-000000000002",
      p_storage_path: "birth-giving/two.pdf",
    });
  });
});
