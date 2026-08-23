import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TeamActivityForm } from "./team-activity-form"
import type { TeamActivity, TeamActivityWithCreator } from "@/lib/tymovy-denik/types"

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"

const mocks = vi.hoisted(() => ({
  createObjectUrl: vi.fn(),
  fetch: vi.fn(),
  optimizeImageToFit: vi.fn(),
  revokeObjectUrl: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("@/lib/storage/image-optimizer", () => ({
  optimizeImageToFit: mocks.optimizeImageToFit,
}))
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    throw new Error("The form must not mutate Supabase directly")
  },
}))
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

const EXISTING_IMAGE_PATH = "team-activities/team-1/activity.webp"
const OPTIMIZED_PHOTO = new File(["optimized"], "activity.webp", { type: "image/webp" })

const ACTIVITY: TeamActivity = {
  id: "activity-1",
  team_id: "team-1",
  occurred_at: "2026-08-22",
  activity_type: "Teambuilding",
  participants: null,
  reason: null,
  reflection: null,
  image_path: EXISTING_IMAGE_PATH,
  removed_at: null,
  created_at: "2026-08-22T12:00:00Z",
  updated_at: "2026-08-22T12:00:00Z",
  created_by_profile_id: "profile-1",
  updated_by_profile_id: "profile-1",
}

function successResponse(activity: TeamActivityWithCreator = ACTIVITY as TeamActivityWithCreator) {
  return new Response(JSON.stringify({ data: activity }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

function submittedFormData(): FormData {
  const init = mocks.fetch.mock.calls[0]?.[1] as RequestInit | undefined
  expect(init?.body).toBeInstanceOf(FormData)
  return init!.body as FormData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", mocks.fetch)
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: mocks.createObjectUrl,
    revokeObjectURL: mocks.revokeObjectUrl,
  })
  mocks.createObjectUrl.mockReturnValue("blob:optimized-preview")
  mocks.optimizeImageToFit.mockResolvedValue(OPTIMIZED_PHOTO)
  mocks.fetch.mockResolvedValue(successResponse())
})

describe("TeamActivityForm", () => {
  it("keeps the existing photo and submits edits through the authenticated API", async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    const updated = { ...ACTIVITY, participants: "Celý tým" } as TeamActivityWithCreator
    mocks.fetch.mockResolvedValue(successResponse(updated))

    render(<TeamActivityForm initial={ACTIVITY} onSuccess={onSuccess} onCancel={vi.fn()} />)

    await user.clear(screen.getByLabelText("Typ akce"))
    await user.type(screen.getByLabelText("Typ akce"), "Nový typ akce")
    await user.click(screen.getByRole("button", { name: "Uložit změny" }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(updated))
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/tymovy-denik/activities/activity-1",
      expect.objectContaining({ method: "PATCH" }),
    )

    const formData = submittedFormData()
    expect(formData.get("photo")).toBeNull()
    expect(JSON.parse(formData.get("payload") as string)).toEqual(expect.objectContaining({
      activityType: "Nový typ akce",
      expectedUpdatedAt: ACTIVITY.updated_at,
      participants: null,
      photoAction: "keep",
    }))
  })

  it("optimizes a selected photo before creating its preview and revokes the preview URL", async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <TeamActivityForm onSuccess={vi.fn()} onCancel={vi.fn()} />,
    )
    const sourcePhoto = new File(["source"], "activity.png", { type: "image/png" })

    await user.upload(screen.getByLabelText("Vybrat fotografii"), sourcePhoto)

    await waitFor(() => {
      expect(mocks.optimizeImageToFit).toHaveBeenCalledWith(sourcePhoto, {
        format: "image/webp",
        maxEdge: 1600,
        quality: 0.82,
      })
    })
    expect(mocks.createObjectUrl).toHaveBeenCalledWith(OPTIMIZED_PHOTO)
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "blob:optimized-preview")

    unmount()
    expect(mocks.revokeObjectUrl).toHaveBeenCalledWith("blob:optimized-preview")
  })

  it("submits the optimized photo with the activity in one multipart request", async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<TeamActivityForm onSuccess={onSuccess} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText("Typ akce"), "Výlet")
    await user.upload(
      screen.getByLabelText("Vybrat fotografii"),
      new File(["source"], "activity.png", { type: "image/png" }),
    )
    await screen.findByRole("presentation")
    await user.click(screen.getByRole("button", { name: "Přidat akci" }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/tymovy-denik/activities",
      expect.objectContaining({ method: "POST" }),
    )
    const formData = submittedFormData()
    expect(formData.get("photo")).toBe(OPTIMIZED_PHOTO)
    expect(JSON.parse(formData.get("payload") as string)).toEqual(expect.objectContaining({
      activityType: "Výlet",
      photoAction: "replace",
    }))
  })

  it("shows the server error and keeps the form open when saving fails", async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    mocks.fetch.mockResolvedValue(new Response(
      JSON.stringify({ error: "Akci mezitím upravil někdo další." }),
      { status: 409, headers: { "content-type": "application/json" } },
    ))
    render(<TeamActivityForm initial={ACTIVITY} onSuccess={onSuccess} onCancel={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "Odebrat fotografii" }))
    await user.click(screen.getByRole("button", { name: "Uložit změny" }))

    await expect(screen.findByText("Akci mezitím upravil někdo další.")).resolves.toBeVisible()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith("Nepodařilo se uložit akci")
    expect(JSON.parse(submittedFormData().get("payload") as string)).toEqual(expect.objectContaining({
      photoAction: "remove",
    }))
  })
})
