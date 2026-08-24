import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  birthGivingMutationErrorResponse: vi.fn(),
  deleteFile: vi.fn(),
  generatePresignedUploadForKey: vi.fn(),
  getSignedStorageUrl: vi.fn(),
  inspectStorageObject: vi.fn(),
  notifyParticipantsOfAssignment: vi.fn(),
  requireBirthGivingApiContext: vi.fn(),
}));

vi.mock("@/app/api/birth-giving/_shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/api/birth-giving/_shared")>()),
  birthGivingMutationErrorResponse: mocks.birthGivingMutationErrorResponse,
  isBirthGivingApiGateFailure: () => false,
  requireBirthGivingApiContext: mocks.requireBirthGivingApiContext,
}));

vi.mock("@/lib/storage/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage/service")>()),
  deleteFile: mocks.deleteFile,
  generatePresignedUploadForKey: mocks.generatePresignedUploadForKey,
  getSignedStorageUrl: mocks.getSignedStorageUrl,
  inspectStorageObject: mocks.inspectStorageObject,
}));

// The confirm route may fire the assignment-release notification in Task 9;
// keep the module mocked so adding the call later cannot break this suite.
vi.mock("@/lib/notifications/birth-giving-notifications", () => ({
  notifyParticipantsOfAssignment: mocks.notifyParticipantsOfAssignment,
}));

import { POST as confirmAssignment } from "@/app/api/birth-giving/events/[eventId]/assignment/confirm/route";
import { POST as markAssignmentMissing } from "@/app/api/birth-giving/events/[eventId]/assignment/missing/route";
import { GET as downloadAssignment } from "@/app/api/birth-giving/events/[eventId]/assignment/download/route";
import { POST as presignAssignment } from "@/app/api/birth-giving/events/[eventId]/assignment/presign/route";
import { POST as confirmResult } from "@/app/api/birth-giving/events/[eventId]/teams/[teamId]/results/confirm/route";
import { POST as markResultMissing } from "@/app/api/birth-giving/events/[eventId]/teams/[teamId]/results/missing/route";
import { DELETE as removeResultFile } from "@/app/api/birth-giving/result-files/[fileId]/route";
import { GET as downloadResultFile } from "@/app/api/birth-giving/result-files/[fileId]/download/route";

const EVENT_ID = "00000000-0000-4000-8000-000000000001";
const TEAM_ID = "00000000-0000-4000-8000-000000000002";
const PROFILE_ID = "00000000-0000-4000-8000-000000000003";
const OTHER_PROFILE_ID = "00000000-0000-4000-8000-000000000004";
const FILE_ID = "00000000-0000-4000-8000-000000000005";
const ASSIGNMENT_PATH = `birth-giving/assignments/${EVENT_ID}/assignment.pdf`;
const RESULT_PATH = `birth-giving/results/${EVENT_ID}/${TEAM_ID}/result.pdf`;
const SIGNED_URL = "https://signed.example/storage/object";

type RpcError = { code: string; message: string; details: string; hint: string };

function postRequest(storagePath: string, extra: Record<string, unknown> = {}): Request {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileSize: 9,
      mimeType: "application/pdf",
      originalFileName: "file.pdf",
      storagePath,
      ...extra,
    }),
  });
}

// Presign does not accept a storage path (the key is generated server-side).
function presignRequest(): Request {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileSize: 9,
      mimeType: "application/pdf",
      originalFileName: "file.pdf",
    }),
  });
}

function createSupabase(rpcData: unknown = null, rpcError: RpcError | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError });
  return { rpc, supabase: { rpc } };
}

function fromChain<TRow>(rows: TRow[] | null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: rows?.[0] ?? null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: rows?.[0] ?? null, error: null });
  chain.then = (onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(onFulfilled({ data: rows, error: null }));
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inspectStorageObject.mockResolvedValue({ size: 9, contentType: "application/pdf" });
  mocks.deleteFile.mockResolvedValue(undefined);
  mocks.getSignedStorageUrl.mockResolvedValue(SIGNED_URL);
  mocks.birthGivingMutationErrorResponse.mockResolvedValue(new Response(null, { status: 500 }));
});

describe("assignment confirm route", () => {
  it("inspects the uploaded object before confirming through birth_giving_set_assignment", async () => {
    const { rpc, supabase } = createSupabase(null);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await confirmAssignment(postRequest(ASSIGNMENT_PATH) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(mocks.inspectStorageObject).toHaveBeenCalledWith("documents", ASSIGNMENT_PATH);
    expect(mocks.inspectStorageObject.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[0],
    );
    expect(rpc).toHaveBeenCalledWith("birth_giving_set_assignment", {
      p_event_id: EVENT_ID,
      p_state: "present",
      p_storage_path: ASSIGNMENT_PATH,
      p_original_file_name: "file.pdf",
      p_mime_type: "application/pdf",
      p_file_size: 9,
    });
    expect(mocks.deleteFile).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { storagePath: ASSIGNMENT_PATH } });
  });

  it("rejects a storage path outside the event prefix without inspecting or writing", async () => {
    const { rpc, supabase } = createSupabase();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await confirmAssignment(
      postRequest(`birth-giving/results/${EVENT_ID}/${TEAM_ID}/file.pdf`) as never,
      { params: Promise.resolve({ eventId: EVENT_ID }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_PAYLOAD" });
    expect(mocks.inspectStorageObject).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a missing storage object", async () => {
    const { supabase } = createSupabase();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });
    mocks.inspectStorageObject.mockResolvedValue(null);

    const response = await confirmAssignment(postRequest(ASSIGNMENT_PATH) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("nebyl nalezen"),
    });
  });

  it("rejects a size mismatch between the object and the submitted metadata", async () => {
    const { rpc, supabase } = createSupabase();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });
    mocks.inspectStorageObject.mockResolvedValue({ size: 10, contentType: "application/pdf" });

    const response = await confirmAssignment(postRequest(ASSIGNMENT_PATH) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("odpovídá"),
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a content-type mismatch and normalizes parameters", async () => {
    const { rpc, supabase } = createSupabase();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });
    mocks.inspectStorageObject.mockResolvedValue({
      size: 9,
      contentType: "application/pdf; charset=utf-8",
    });

    const response = await confirmAssignment(postRequest(ASSIGNMENT_PATH) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects payloads that attempt to choose uploader or timestamp metadata", async () => {
    const { rpc, supabase } = createSupabase();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await confirmAssignment(
      postRequest(ASSIGNMENT_PATH, {
        uploadedAt: "2026-01-01T00:00:00.000Z",
        uploadedByProfileId: PROFILE_ID,
      }) as never,
      { params: Promise.resolve({ eventId: EVENT_ID }) },
    );

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("deletes the newly uploaded object when the RPC fails", async () => {
    const rpcError = { code: "42501", message: "denied", details: "", hint: "" };
    const { supabase } = createSupabase(null, rpcError);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });
    mocks.birthGivingMutationErrorResponse.mockResolvedValue(new Response(null, { status: 403 }));

    const response = await confirmAssignment(postRequest(ASSIGNMENT_PATH) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(mocks.deleteFile).toHaveBeenCalledWith("documents", ASSIGNMENT_PATH);
    expect(mocks.birthGivingMutationErrorResponse).toHaveBeenCalledWith(rpcError, supabase, EVENT_ID);
    expect(response.status).toBe(403);
  });

  it("deletes the displaced previous object after a successful replacement", async () => {
    const oldPath = `birth-giving/assignments/${EVENT_ID}/old.pdf`;
    const { supabase } = createSupabase(oldPath);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await confirmAssignment(postRequest(ASSIGNMENT_PATH) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(mocks.deleteFile).toHaveBeenCalledWith("documents", oldPath);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { storagePath: ASSIGNMENT_PATH } });
  });

  it("reports a failed replacement cleanup as a server error", async () => {
    const oldPath = `birth-giving/assignments/${EVENT_ID}/old.pdf`;
    mocks.deleteFile.mockRejectedValue(new Error("storage down"));
    const { supabase } = createSupabase(oldPath);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await confirmAssignment(postRequest(ASSIGNMENT_PATH) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(500);
  });

  it("re-confirming the same path does not delete the just-committed object", async () => {
    // A retry after a lost response or a double-submit replays the exact path
    // the RPC already committed, so it reports it back as the "previous" path.
    // Deleting it would remove the object the row now references.
    const { supabase } = createSupabase(ASSIGNMENT_PATH);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await confirmAssignment(postRequest(ASSIGNMENT_PATH) as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(mocks.deleteFile).not.toHaveBeenCalledWith("documents", ASSIGNMENT_PATH);
    expect(mocks.deleteFile).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { storagePath: ASSIGNMENT_PATH } });
  });
});

describe("assignment missing route", () => {
  it("marks the assignment missing through birth_giving_set_assignment and deletes the previous object", async () => {
    const oldPath = `birth-giving/assignments/${EVENT_ID}/old.pdf`;
    const { rpc, supabase } = createSupabase(oldPath);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await markAssignmentMissing(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(rpc).toHaveBeenCalledWith("birth_giving_set_assignment", {
      p_event_id: EVENT_ID,
      p_state: "missing",
      p_storage_path: null,
      p_original_file_name: null,
      p_mime_type: null,
      p_file_size: null,
    });
    expect(mocks.deleteFile).toHaveBeenCalledWith("documents", oldPath);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { state: "missing" } });
  });

  it("deletes nothing when there was no previous assignment", async () => {
    const { supabase } = createSupabase(null);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await markAssignmentMissing(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(mocks.deleteFile).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("surfaces a failed cleanup as a server error", async () => {
    mocks.deleteFile.mockRejectedValue(new Error("storage down"));
    const { supabase } = createSupabase(`birth-giving/assignments/${EVENT_ID}/old.pdf`);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await markAssignmentMissing(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(500);
  });
});

describe("assignment download route", () => {
  it("downloads the visible assignment through the visibility RPC and redirects", async () => {
    const visible = [
      {
        assignment_state: "present",
        assignment_storage_path: ASSIGNMENT_PATH,
        assignment_file_name: "file.pdf",
        assignment_mime_type: "application/pdf",
        assignment_file_size: 9,
        assignment_uploaded_at: "2026-09-01T08:00:00.000Z",
        assignment_uploaded_by_profile_id: PROFILE_ID,
      },
    ];
    const { rpc, supabase } = createSupabase(visible);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await downloadAssignment(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(rpc).toHaveBeenCalledWith("birth_giving_get_visible_assignment", {
      p_event_id: EVENT_ID,
    });
    expect(mocks.getSignedStorageUrl).toHaveBeenCalledWith("documents", ASSIGNMENT_PATH, 60);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(SIGNED_URL);
  });

  it.each([
    ["missing", "missing", ASSIGNMENT_PATH],
    ["blurred pre-release row", "none", null],
    ["no visible row", null, null],
  ])("refuses to sign a %s assignment (404)", async (_label, state, storagePath) => {
    const { rpc, supabase } = createSupabase(
      storagePath === null && state === null
        ? []
        : [{ assignment_state: state, assignment_storage_path: storagePath }],
    );
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await downloadAssignment(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(rpc).toHaveBeenCalledWith("birth_giving_get_visible_assignment", {
      p_event_id: EVENT_ID,
    });
    expect(mocks.getSignedStorageUrl).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("zatím není k dispozici"),
    });
  });
});

describe("assignment presign route", () => {
  function presignContext(event: { organizer_profile_ids: string[] } | null) {
    const supabase = { from: vi.fn().mockReturnValue(fromChain<typeof event>([event])) } as never;
    return { from: (supabase as { from: ReturnType<typeof vi.fn> }).from, supabase };
  }

  beforeEach(() => {
    mocks.generatePresignedUploadForKey.mockImplementation((_bucket: string, key: string) =>
      Promise.resolve({ url: `https://presign/${key}`, fields: {}, key, expiresAt: new Date() }),
    );
  });

  it("presigns an upload key under the assignment prefix for an organizer", async () => {
    const { from, supabase } = presignContext({ organizer_profile_ids: [PROFILE_ID] });
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await presignAssignment(presignRequest() as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(from).toHaveBeenCalledWith("birth_giving_events");
    const [, generatedKey] = mocks.generatePresignedUploadForKey.mock.calls[0];
    expect(generatedKey).toEqual(expect.stringMatching(new RegExp(`^birth-giving/assignments/${EVENT_ID}/`)));
    expect(generatedKey).toMatch(/\.pdf$/);
    expect(mocks.generatePresignedUploadForKey).toHaveBeenCalledWith("documents", generatedKey);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.key).toBe(generatedKey);
  });

  it("rejects a non-organizer caller with 403", async () => {
    const { supabase } = presignContext({ organizer_profile_ids: [OTHER_PROFILE_ID] });
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await presignAssignment(presignRequest() as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(403);
    expect(mocks.generatePresignedUploadForKey).not.toHaveBeenCalled();
  });

  it("rejects a creator who is not listed as an organizer (organizer-only)", async () => {
    const { supabase } = presignContext({ organizer_profile_ids: [OTHER_PROFILE_ID] });
    const supabaseWithCreator = {
      from: vi.fn().mockReturnValue(
        fromChain<{ organizer_profile_ids: string[]; created_by_profile_id: string }>([
          { organizer_profile_ids: [OTHER_PROFILE_ID], created_by_profile_id: PROFILE_ID },
        ]),
      ),
    };
    mocks.requireBirthGivingApiContext.mockResolvedValue({
      profileId: PROFILE_ID,
      supabase: supabaseWithCreator,
    });

    const response = await presignAssignment(presignRequest() as never, {
      params: Promise.resolve({ eventId: EVENT_ID }),
    });

    expect(response.status).toBe(403);
    expect(mocks.generatePresignedUploadForKey).not.toHaveBeenCalled();
    void supabase;
  });
});

describe("result confirm route", () => {
  it("inspects the object before adding the result file through birth_giving_add_result_file", async () => {
    const { rpc, supabase } = createSupabase(FILE_ID);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await confirmResult(postRequest(RESULT_PATH) as never, {
      params: Promise.resolve({ eventId: EVENT_ID, teamId: TEAM_ID }),
    });

    expect(mocks.inspectStorageObject).toHaveBeenCalledWith("documents", RESULT_PATH);
    expect(mocks.inspectStorageObject.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[0],
    );
    expect(rpc).toHaveBeenCalledWith("birth_giving_add_result_file", {
      p_event_id: EVENT_ID,
      p_team_id: TEAM_ID,
      p_storage_path: RESULT_PATH,
      p_original_file_name: "file.pdf",
      p_mime_type: "application/pdf",
      p_file_size: 9,
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ data: { id: FILE_ID } });
    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });

  it("rejects a result path outside the team prefix without inspecting or writing", async () => {
    const { rpc, supabase } = createSupabase();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await confirmResult(
      postRequest(`birth-giving/assignments/${EVENT_ID}/file.pdf`) as never,
      { params: Promise.resolve({ eventId: EVENT_ID, teamId: TEAM_ID }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.inspectStorageObject).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a missing or mismatched result object", async () => {
    const { rpc, supabase } = createSupabase();
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });
    mocks.inspectStorageObject.mockResolvedValue({ size: 7, contentType: "image/png" });

    const response = await confirmResult(postRequest(RESULT_PATH) as never, {
      params: Promise.resolve({ eventId: EVENT_ID, teamId: TEAM_ID }),
    });

    expect(response.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("deletes the newly uploaded object when the RPC fails", async () => {
    const rpcError = { code: "42501", message: "denied", details: "", hint: "" };
    const { supabase } = createSupabase(null, rpcError);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await confirmResult(postRequest(RESULT_PATH) as never, {
      params: Promise.resolve({ eventId: EVENT_ID, teamId: TEAM_ID }),
    });

    expect(mocks.deleteFile).toHaveBeenCalledWith("documents", RESULT_PATH);
    expect(mocks.birthGivingMutationErrorResponse).toHaveBeenCalledWith(rpcError, supabase, EVENT_ID);
    expect(response.status).toBe(500);
  });
});

describe("result missing route", () => {
  it("marks results missing through birth_giving_mark_result_missing and deletes every returned path", async () => {
    const clearedPaths = [RESULT_PATH, `birth-giving/results/${EVENT_ID}/${TEAM_ID}/older.pdf`];
    const { rpc, supabase } = createSupabase(clearedPaths);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await markResultMissing(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID, teamId: TEAM_ID }),
    });

    expect(rpc).toHaveBeenCalledWith("birth_giving_mark_result_missing", {
      p_event_id: EVENT_ID,
      p_team_id: TEAM_ID,
    });
    expect(mocks.deleteFile).toHaveBeenCalledTimes(2);
    expect(mocks.deleteFile).toHaveBeenCalledWith("documents", RESULT_PATH);
    expect(mocks.deleteFile).toHaveBeenCalledWith(
      "documents",
      `birth-giving/results/${EVENT_ID}/${TEAM_ID}/older.pdf`,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { state: "missing" } });
  });

  it("surfaces a failed cleanup as a server error", async () => {
    mocks.deleteFile.mockRejectedValue(new Error("storage down"));
    const { supabase } = createSupabase([RESULT_PATH]);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await markResultMissing(new Request("http://localhost") as never, {
      params: Promise.resolve({ eventId: EVENT_ID, teamId: TEAM_ID }),
    });

    expect(response.status).toBe(500);
  });
});

describe("result file removal route", () => {
  it("removes a result file through birth_giving_remove_result_file and deletes the returned path", async () => {
    const { rpc, supabase } = createSupabase(RESULT_PATH);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await removeResultFile(new Request("http://localhost") as never, {
      params: Promise.resolve({ fileId: FILE_ID }),
    });

    expect(rpc).toHaveBeenCalledWith("birth_giving_remove_result_file", {
      p_result_file_id: FILE_ID,
    });
    expect(mocks.deleteFile).toHaveBeenCalledWith("documents", RESULT_PATH);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("deletes nothing when the RPC returns no path", async () => {
    const { supabase } = createSupabase(null);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await removeResultFile(new Request("http://localhost") as never, {
      params: Promise.resolve({ fileId: FILE_ID }),
    });

    expect(mocks.deleteFile).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("surfaces a failed cleanup as a server error", async () => {
    mocks.deleteFile.mockRejectedValue(new Error("storage down"));
    const { supabase } = createSupabase(RESULT_PATH);
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await removeResultFile(new Request("http://localhost") as never, {
      params: Promise.resolve({ fileId: FILE_ID }),
    });

    expect(response.status).toBe(500);
  });
});

describe("result file download route", () => {
  it("downloads a result file found through RLS-visible teams", async () => {
    const visibleFiles = [{ id: FILE_ID, storage_path: RESULT_PATH }];
    const supabase = { from: vi.fn().mockReturnValue(fromChain([{ result_files: visibleFiles }])) };
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await downloadResultFile(new Request("http://localhost") as never, {
      params: Promise.resolve({ fileId: FILE_ID }),
    });

    expect(supabase.from).toHaveBeenCalledWith("birth_giving_teams");
    expect(mocks.getSignedStorageUrl).toHaveBeenCalledWith("documents", RESULT_PATH, 60);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(SIGNED_URL);
  });

  it("returns 404 when the file only exists in a team the caller cannot see", async () => {
    const supabase = { from: vi.fn().mockReturnValue(fromChain<unknown[]>([])) };
    mocks.requireBirthGivingApiContext.mockResolvedValue({ profileId: PROFILE_ID, supabase });

    const response = await downloadResultFile(new Request("http://localhost") as never, {
      params: Promise.resolve({ fileId: FILE_ID }),
    });

    expect(response.status).toBe(404);
    expect(mocks.getSignedStorageUrl).not.toHaveBeenCalled();
  });
});