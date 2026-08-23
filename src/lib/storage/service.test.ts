import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upload: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: mocks.from },
  }),
}))

import { uploadFile } from "./service"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.from.mockReturnValue({ upload: mocks.upload })
  mocks.upload.mockResolvedValue({ error: null })
})

describe("uploadFile", () => {
  it("leaves cacheControl absent so the Supabase default applies", async () => {
    const content = Buffer.from("image")

    await uploadFile("images", "book/cover.webp", content, "image/webp")

    expect(mocks.upload).toHaveBeenCalledWith("book/cover.webp", content, expect.objectContaining({
      contentType: "image/webp",
      upsert: true,
    }))
    const options = mocks.upload.mock.calls[0]?.[2] as Record<string, unknown>
    expect(Object.hasOwn(options, "cacheControl")).toBe(false)
  })

  it("passes explicit immutable caching and insert-only behavior", async () => {
    const content = Buffer.from("image")

    await uploadFile("images", "team-activities/team-1/photo.webp", content, "image/webp", {
      cacheControl: "31536000",
      upsert: false,
    })

    expect(mocks.upload).toHaveBeenCalledWith(
      "team-activities/team-1/photo.webp",
      content,
      {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: false,
      },
    )
  })
})
