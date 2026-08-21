import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminRpc: vi.fn(),
  birthGivingMutationErrorResponse: vi.fn(),
  createAdminClient: vi.fn(),
  deleteFile: vi.fn(),
  downloadStorageObject: vi.fn(),
  inspectStorageObject: vi.fn(),
  requireBirthGivingApiContext: vi.fn(),
  sessionRpc: vi.fn(),
}));

vi.mock("@/app/api/birth-giving/_shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/api/birth-giving/_shared")>()),
  birthGivingMutationErrorResponse: mocks.birthGivingMutationErrorResponse,
  isBirthGivingApiGateFailure: () => false,
  requireBirthGivingApiContext: mocks.requireBirthGivingApiContext,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/storage/service", () => ({
  deleteFile: mocks.deleteFile,
  downloadStorageObject: mocks.downloadStorageObject,
  inspectStorageObject: mocks.inspectStorageObject,
}));

import { POST as confirmAssignment } from "@/app/api/birth-giving/events/[eventId]/assignment/confirm/route";
import { POST as markAssignmentMissing } from "@/app/api/birth-giving/events/[eventId]/assignment/missing/route";
import { POST as confirmResult } from "@/app/api/birth-giving/events/[eventId]/teams/[teamId]/results/confirm/route";
import { POST as markResultMissing } from "@/app/api/birth-giving/events/[eventId]/teams/[teamId]/results/missing/route";
import { DELETE as removeResultFile } from "@/app/api/birth-giving/result-files/[fileId]/route";

const EVENT_ID = "00000000-0000-4000-8000-000000000001";
const TEAM_ID = "00000000-0000-4000-8000-000000000002";
const PROFILE_ID = "00000000-0000-4000-8000-000000000003";
const FILE_ID = "00000000-0000-4000-8000-000000000004";

function request(storagePath: string): Request {
  return new Request("http://localhost", {
    body: JSON.stringify({
      fileSize: 9,
      mimeType: "application/pdf",
      originalFileName: "file.pdf",
      storagePath,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("Birth Giving confirmation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase: { rpc: mocks.sessionRpc } });
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.adminRpc });
    mocks.inspectStorageObject.mockResolvedValue({ contentType: "application/pdf", size: 9 });
    mocks.downloadStorageObject.mockResolvedValue(Buffer.from("%PDF-1.7"));
    mocks.adminRpc.mockResolvedValue({ data: EVENT_ID, error: null });
    mocks.sessionRpc.mockResolvedValue({ data: true, error: null });
  });

  it("confirms assignments through service_role with the authorized actor and never deletes an old path", async () => {
    const storagePath = `birth-giving/assignments/${EVENT_ID}/file.pdf`;
    const response = await confirmAssignment(request(storagePath) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(200);
    expect(mocks.adminRpc).toHaveBeenCalledWith("birth_giving_confirm_assignment", {
      p_actor_profile_id: PROFILE_ID,
      p_event_id: EVENT_ID,
      p_file_size: 9,
      p_mime_type: "application/pdf",
      p_original_file_name: "file.pdf",
      p_storage_path: storagePath,
    });
    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });

  it("rejects mismatched bytes before result confirmation", async () => {
    mocks.downloadStorageObject.mockResolvedValue(Buffer.from("not a pdf"));
    const storagePath = `birth-giving/results/${EVENT_ID}/${TEAM_ID}/file.pdf`;
    const response = await confirmResult(request(storagePath) as never, {
      params: Promise.resolve({ eventId: EVENT_ID, teamId: TEAM_ID }),
    });

    expect(response.status).toBe(409);
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });

  it.each([
    ["assignment", () => confirmAssignment(request(`birth-giving/assignments/${EVENT_ID}/file.pdf`) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    })],
    ["result", () => confirmResult(request(`birth-giving/results/${EVENT_ID}/${TEAM_ID}/file.pdf`) as never, {
      params: Promise.resolve({ eventId: EVENT_ID, teamId: TEAM_ID }),
    })],
  ])("rejects unauthorized %s confirmation before privileged storage inspection", async (_kind, confirm) => {
    mocks.sessionRpc.mockResolvedValue({ data: false, error: null });

    const response = await confirm();

    expect(response.status).toBe(403);
    expect(mocks.inspectStorageObject).not.toHaveBeenCalled();
    expect(mocks.downloadStorageObject).not.toHaveBeenCalled();
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });

  it("leaves replaced and removed paths for delayed reference-aware cleanup", async () => {
    mocks.sessionRpc
      .mockResolvedValueOnce({ data: `birth-giving/assignments/${EVENT_ID}/old.pdf`, error: null })
      .mockResolvedValueOnce({ data: [`birth-giving/results/${EVENT_ID}/${TEAM_ID}/old.pdf`], error: null })
      .mockResolvedValueOnce({ data: `birth-giving/results/${EVENT_ID}/${TEAM_ID}/one.pdf`, error: null });

    await markAssignmentMissing(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });
    await markResultMissing(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID, teamId: TEAM_ID }),
    });
    await removeResultFile(new Request("http://localhost") as never, {
      params: Promise.resolve({ fileId: FILE_ID }),
    });

    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });
});
