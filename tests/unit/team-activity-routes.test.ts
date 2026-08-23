import { beforeEach, describe, expect, it, vi } from "vitest"
import sharp from "sharp"

const mocks = vi.hoisted(() => ({
  deleteFile: vi.fn(),
  generateFileKey: vi.fn(),
  requireTeamActivityApiContext: vi.fn(),
  uploadFile: vi.fn(),
}))

vi.mock("@/app/api/tymovy-denik/activities/_shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/api/tymovy-denik/activities/_shared")>()),
  requireTeamActivityApiContext: mocks.requireTeamActivityApiContext,
}))

vi.mock("@/lib/storage/service", () => ({
  deleteFile: mocks.deleteFile,
  generateFileKey: mocks.generateFileKey,
  uploadFile: mocks.uploadFile,
}))

import { deleteTeamActivityPhoto } from "@/app/api/tymovy-denik/activities/_shared"
import { POST } from "@/app/api/tymovy-denik/activities/route"
import { DELETE, PATCH } from "@/app/api/tymovy-denik/activities/[id]/route"

const ACTIVITY_ID = "00000000-0000-4000-8000-000000000001"
const TEAM_ID = "00000000-0000-4000-8000-000000000002"
const PROFILE_ID = "00000000-0000-4000-8000-000000000003"
const OLD_IMAGE_PATH = `team-activities/${TEAM_ID}/old.webp`
const NEW_IMAGE_PATH = `team-activities/${TEAM_ID}/new.webp`
const UPDATED_AT = "2026-08-22T12:00:00.000Z"
const AMBIGUOUS_MUTATION = {
  data: null,
  error: { code: "", message: "TypeError: fetch failed" },
  status: 0,
}

const BASE_PAYLOAD = {
  occurredAt: "2026-08-22",
  activityType: "Teambuilding",
  participants: "Celý tým",
  reason: "Společný čas",
  reflection: "Lepší spolupráce",
  photoAction: "keep",
}

function storedActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVITY_ID,
    team_id: TEAM_ID,
    occurred_at: BASE_PAYLOAD.occurredAt,
    activity_type: BASE_PAYLOAD.activityType,
    participants: BASE_PAYLOAD.participants,
    reason: BASE_PAYLOAD.reason,
    reflection: BASE_PAYLOAD.reflection,
    image_path: OLD_IMAGE_PATH,
    removed_at: null,
    created_at: UPDATED_AT,
    updated_at: UPDATED_AT,
    created_by_profile_id: PROFILE_ID,
    updated_by_profile_id: PROFILE_ID,
    created_by: null,
    updated_by: null,
    ...overrides,
  }
}

const VALID_WEBP = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
  "base64",
)

function request(payload: object, photo?: File, method = "POST"): Request {
  const formData = new FormData()
  formData.set("payload", JSON.stringify(payload))
  if (photo) formData.set("photo", photo)
  return new Request("http://localhost/api/tymovy-denik/activities", { body: formData, method })
}

function deleteRequest(expectedUpdatedAt = UPDATED_AT): Request {
  return new Request("http://localhost/api/tymovy-denik/activities", {
    body: JSON.stringify({ expectedUpdatedAt }),
    headers: { "content-type": "application/json" },
    method: "DELETE",
  })
}

function queryBuilder<T>(result: T) {
  const builder = {
    eq: vi.fn(),
    insert: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    update: vi.fn(),
  }
  builder.eq.mockReturnValue(builder)
  builder.insert.mockReturnValue(builder)
  builder.is.mockReturnValue(builder)
  builder.select.mockReturnValue(builder)
  builder.update.mockReturnValue(builder)
  return builder
}

function context(from: ReturnType<typeof vi.fn>) {
  return { profileId: PROFILE_ID, teamId: TEAM_ID, supabase: { from } }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.generateFileKey.mockReturnValue(NEW_IMAGE_PATH)
  mocks.uploadFile.mockResolvedValue(NEW_IMAGE_PATH)
  mocks.deleteFile.mockResolvedValue(undefined)
})

describe("team activity photo cleanup", () => {
  it("retries transient Storage deletion failures during the request", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.deleteFile
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValueOnce(undefined)

    await deleteTeamActivityPhoto(OLD_IMAGE_PATH, TEAM_ID)

    expect(mocks.deleteFile).toHaveBeenCalledTimes(3)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

describe("team activity create route", () => {
  it("attempts cleanup when an upload result is ambiguous", async () => {
    const from = vi.fn()
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))
    mocks.uploadFile.mockRejectedValue(new Error("Upload response was lost"))

    const response = await POST(request(
      { ...BASE_PAYLOAD, photoAction: "replace" },
      new File([VALID_WEBP], "photo.webp", { type: "image/webp" }),
    ) as never)

    expect(response.status).toBe(500)
    expect(mocks.deleteFile).toHaveBeenCalledWith("images", NEW_IMAGE_PATH)
    expect(from).not.toHaveBeenCalled()
  })

  it("removes a newly uploaded photo when the row insert fails", async () => {
    const insert = queryBuilder({ data: null, error: { message: "Database unavailable" } })
    const reconciled = queryBuilder({ data: null, error: null })
    const from = vi.fn().mockReturnValueOnce(insert).mockReturnValueOnce(reconciled)
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await POST(request(
      { ...BASE_PAYLOAD, photoAction: "replace" },
      new File([VALID_WEBP], "photo.webp", { type: "image/webp" }),
    ) as never)

    expect(response.status).toBe(500)
    expect(mocks.uploadFile).toHaveBeenCalledWith(
      "images",
      NEW_IMAGE_PATH,
      expect.any(Buffer),
      "image/webp",
      expect.objectContaining({ cacheControl: "31536000", upsert: false }),
    )
    expect(mocks.deleteFile).toHaveBeenCalledWith("images", NEW_IMAGE_PATH)
  })

  it("keeps a live photo when an insert committed but its response was lost", async () => {
    const insert = queryBuilder(AMBIGUOUS_MUTATION)
    const committed = storedActivity({ image_path: NEW_IMAGE_PATH })
    const reconciled = queryBuilder({ data: committed, error: null })
    const from = vi.fn().mockReturnValueOnce(insert).mockReturnValueOnce(reconciled)
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await POST(request(
      { ...BASE_PAYLOAD, photoAction: "replace" },
      new File([VALID_WEBP], "photo.webp", { type: "image/webp" }),
    ) as never)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ data: committed })
    expect(mocks.deleteFile).not.toHaveBeenCalled()
  })

  it("preserves an uploaded photo while an ambiguous insert may still commit", async () => {
    const insert = queryBuilder(AMBIGUOUS_MUTATION)
    const reconciled = queryBuilder({ data: null, error: null })
    const from = vi.fn().mockReturnValueOnce(insert).mockReturnValueOnce(reconciled)
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await POST(request(
      { ...BASE_PAYLOAD, photoAction: "replace" },
      new File([VALID_WEBP], "photo.webp", { type: "image/webp" }),
    ) as never)

    expect(response.status).toBe(500)
    expect(mocks.deleteFile).not.toHaveBeenCalled()
  })

  it("rejects bytes that are not a WebP image", async () => {
    const from = vi.fn()
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await POST(request(
      { ...BASE_PAYLOAD, photoAction: "replace" },
      new File(["not an image"], "photo.webp", { type: "image/webp" }),
    ) as never)

    expect(response.status).toBe(400)
    expect(mocks.uploadFile).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it("rejects a WebP above the optimized dimension limit", async () => {
    const from = vi.fn()
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))
    const oversizedWebp = await sharp({
      create: {
        width: 1601,
        height: 1,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    }).webp().toBuffer()

    const response = await POST(request(
      { ...BASE_PAYLOAD, photoAction: "replace" },
      new File([Uint8Array.from(oversizedWebp)], "photo.webp", { type: "image/webp" }),
    ) as never)

    expect(response.status).toBe(400)
    expect(mocks.uploadFile).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })
})

describe("team activity update route", () => {
  it("commits a replacement before deleting the old photo", async () => {
    const existing = queryBuilder({
      data: { id: ACTIVITY_ID, image_path: OLD_IMAGE_PATH, updated_at: UPDATED_AT },
      error: null,
    })
    const updated = queryBuilder({
      data: { id: ACTIVITY_ID, image_path: NEW_IMAGE_PATH },
      error: null,
    })
    const from = vi.fn().mockReturnValueOnce(existing).mockReturnValueOnce(updated)
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await PATCH(
      request(
        { ...BASE_PAYLOAD, expectedUpdatedAt: UPDATED_AT, photoAction: "replace" },
        new File([VALID_WEBP], "photo.webp", { type: "image/webp" }),
        "PATCH",
      ) as never,
      { params: Promise.resolve({ id: ACTIVITY_ID }) },
    )

    expect(response.status).toBe(200)
    expect(updated.update).toHaveBeenCalledWith(expect.objectContaining({ image_path: NEW_IMAGE_PATH }))
    expect(mocks.deleteFile).toHaveBeenCalledWith("images", OLD_IMAGE_PATH)
    expect(updated.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteFile.mock.invocationCallOrder[0])
  })

  it("removes the replacement instead of the old photo when the update fails", async () => {
    const existing = queryBuilder({
      data: { id: ACTIVITY_ID, image_path: OLD_IMAGE_PATH, updated_at: UPDATED_AT },
      error: null,
    })
    const updated = queryBuilder({ data: null, error: { message: "Database unavailable" } })
    const reconciled = queryBuilder({ data: storedActivity(), error: null })
    const from = vi.fn()
      .mockReturnValueOnce(existing)
      .mockReturnValueOnce(updated)
      .mockReturnValueOnce(reconciled)
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await PATCH(
      request(
        { ...BASE_PAYLOAD, expectedUpdatedAt: UPDATED_AT, photoAction: "replace" },
        new File([VALID_WEBP], "photo.webp", { type: "image/webp" }),
        "PATCH",
      ) as never,
      { params: Promise.resolve({ id: ACTIVITY_ID }) },
    )

    expect(response.status).toBe(500)
    expect(mocks.deleteFile).toHaveBeenCalledTimes(1)
    expect(mocks.deleteFile).toHaveBeenCalledWith("images", NEW_IMAGE_PATH)
  })

  it("keeps the replacement when an update committed but its response was lost", async () => {
    const existing = queryBuilder({
      data: { id: ACTIVITY_ID, image_path: OLD_IMAGE_PATH, updated_at: UPDATED_AT },
      error: null,
    })
    const updated = queryBuilder(AMBIGUOUS_MUTATION)
    const committed = storedActivity({
      image_path: NEW_IMAGE_PATH,
      updated_at: "2026-08-22T12:01:00.000Z",
    })
    const reconciled = queryBuilder({ data: committed, error: null })
    const from = vi.fn()
      .mockReturnValueOnce(existing)
      .mockReturnValueOnce(updated)
      .mockReturnValueOnce(reconciled)
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await PATCH(
      request(
        { ...BASE_PAYLOAD, expectedUpdatedAt: UPDATED_AT, photoAction: "replace" },
        new File([VALID_WEBP], "photo.webp", { type: "image/webp" }),
        "PATCH",
      ) as never,
      { params: Promise.resolve({ id: ACTIVITY_ID }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: committed })
    expect(mocks.deleteFile).toHaveBeenCalledTimes(1)
    expect(mocks.deleteFile).toHaveBeenCalledWith("images", OLD_IMAGE_PATH)
  })

  it("keeps a committed replacement after a later text edit", async () => {
    const existing = queryBuilder({
      data: { id: ACTIVITY_ID, image_path: OLD_IMAGE_PATH, updated_at: UPDATED_AT },
      error: null,
    })
    const updated = queryBuilder(AMBIGUOUS_MUTATION)
    const laterEdit = storedActivity({
      activity_type: "Pozdější úprava",
      image_path: NEW_IMAGE_PATH,
      updated_at: "2026-08-22T12:02:00.000Z",
    })
    const reconciled = queryBuilder({ data: laterEdit, error: null })
    const from = vi.fn()
      .mockReturnValueOnce(existing)
      .mockReturnValueOnce(updated)
      .mockReturnValueOnce(reconciled)
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await PATCH(
      request(
        { ...BASE_PAYLOAD, expectedUpdatedAt: UPDATED_AT, photoAction: "replace" },
        new File([VALID_WEBP], "photo.webp", { type: "image/webp" }),
        "PATCH",
      ) as never,
      { params: Promise.resolve({ id: ACTIVITY_ID }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: laterEdit })
    expect(mocks.deleteFile).toHaveBeenCalledTimes(1)
    expect(mocks.deleteFile).toHaveBeenCalledWith("images", OLD_IMAGE_PATH)
    expect(mocks.deleteFile).not.toHaveBeenCalledWith("images", NEW_IMAGE_PATH)
  })

  it("preserves a replacement while an ambiguous update may still commit", async () => {
    const existing = queryBuilder({
      data: { id: ACTIVITY_ID, image_path: OLD_IMAGE_PATH, updated_at: UPDATED_AT },
      error: null,
    })
    const updated = queryBuilder(AMBIGUOUS_MUTATION)
    const reconciled = queryBuilder({ data: storedActivity(), error: null })
    const from = vi.fn()
      .mockReturnValueOnce(existing)
      .mockReturnValueOnce(updated)
      .mockReturnValueOnce(reconciled)
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await PATCH(
      request(
        { ...BASE_PAYLOAD, expectedUpdatedAt: UPDATED_AT, photoAction: "replace" },
        new File([VALID_WEBP], "photo.webp", { type: "image/webp" }),
        "PATCH",
      ) as never,
      { params: Promise.resolve({ id: ACTIVITY_ID }) },
    )

    expect(response.status).toBe(500)
    expect(mocks.deleteFile).not.toHaveBeenCalled()
  })

  it("clears the row before deleting an explicitly removed photo", async () => {
    const existing = queryBuilder({
      data: { id: ACTIVITY_ID, image_path: OLD_IMAGE_PATH, updated_at: UPDATED_AT },
      error: null,
    })
    const updated = queryBuilder({ data: { id: ACTIVITY_ID, image_path: null }, error: null })
    const from = vi.fn().mockReturnValueOnce(existing).mockReturnValueOnce(updated)
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await PATCH(
      request(
        { ...BASE_PAYLOAD, expectedUpdatedAt: UPDATED_AT, photoAction: "remove" },
        undefined,
        "PATCH",
      ) as never,
      { params: Promise.resolve({ id: ACTIVITY_ID }) },
    )

    expect(response.status).toBe(200)
    expect(updated.update).toHaveBeenCalledWith(expect.objectContaining({ image_path: null }))
    expect(mocks.deleteFile).toHaveBeenCalledWith("images", OLD_IMAGE_PATH)
  })
})

describe("team activity delete route", () => {
  it("rejects deletion from a stale detail page", async () => {
    const existing = queryBuilder({
      data: {
        id: ACTIVITY_ID,
        image_path: OLD_IMAGE_PATH,
        updated_at: "2026-08-22T13:00:00.000Z",
      },
      error: null,
    })
    const from = vi.fn().mockReturnValue(existing)
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: ACTIVITY_ID }),
    })

    expect(response.status).toBe(409)
    expect(existing.update).not.toHaveBeenCalled()
    expect(mocks.deleteFile).not.toHaveBeenCalled()
  })

  it("clears the image reference before deleting the stored object", async () => {
    const existing = queryBuilder({
      data: { id: ACTIVITY_ID, image_path: OLD_IMAGE_PATH, updated_at: UPDATED_AT },
      error: null,
    })
    const removed = queryBuilder({ data: { id: ACTIVITY_ID }, error: null })
    const from = vi.fn().mockReturnValueOnce(existing).mockReturnValueOnce(removed)
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: ACTIVITY_ID }),
    })

    expect(response.status).toBe(200)
    expect(removed.update).toHaveBeenCalledWith(expect.objectContaining({
      image_path: null,
      removed_at: expect.any(String),
      updated_by_profile_id: PROFILE_ID,
    }))
    expect(mocks.deleteFile).toHaveBeenCalledWith("images", OLD_IMAGE_PATH)
  })

  it("cleans up the photo when deletion committed but its response was lost", async () => {
    const existing = queryBuilder({
      data: { id: ACTIVITY_ID, image_path: OLD_IMAGE_PATH, updated_at: UPDATED_AT },
      error: null,
    })
    const removed = queryBuilder(AMBIGUOUS_MUTATION)
    const committed = queryBuilder({
      data: { id: ACTIVITY_ID, image_path: null, removed_at: "2026-08-22T12:01:00.000Z" },
      error: null,
    })
    const from = vi.fn()
      .mockReturnValueOnce(existing)
      .mockReturnValueOnce(removed)
      .mockReturnValueOnce(committed)
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: ACTIVITY_ID }),
    })

    expect(response.status).toBe(200)
    expect(mocks.deleteFile).toHaveBeenCalledWith("images", OLD_IMAGE_PATH)
  })

  it("preserves the photo when ambiguous delete reconciliation finds no row", async () => {
    const existing = queryBuilder({
      data: { id: ACTIVITY_ID, image_path: OLD_IMAGE_PATH, updated_at: UPDATED_AT },
      error: null,
    })
    const removed = queryBuilder(AMBIGUOUS_MUTATION)
    const unresolved = queryBuilder({ data: null, error: null })
    const from = vi.fn()
      .mockReturnValueOnce(existing)
      .mockReturnValueOnce(removed)
      .mockReturnValueOnce(unresolved)
    mocks.requireTeamActivityApiContext.mockResolvedValue(context(from))

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: ACTIVITY_ID }),
    })

    expect(response.status).toBe(500)
    expect(mocks.deleteFile).not.toHaveBeenCalled()
  })
})
