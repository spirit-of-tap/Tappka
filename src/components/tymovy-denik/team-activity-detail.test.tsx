import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TeamActivityDetail } from "./team-activity-detail"
import type { TeamActivityWithCreator } from "@/lib/tymovy-denik/types"

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    throw new Error("The detail must not mutate Supabase directly")
  },
}))
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

const ACTIVITY: TeamActivityWithCreator = {
  id: "activity-1",
  team_id: "team-1",
  occurred_at: "2026-08-22",
  activity_type: "Výlet",
  participants: null,
  reason: null,
  reflection: "Bylo to přínosné",
  image_path: null,
  removed_at: null,
  created_at: "2026-08-22T12:00:00Z",
  updated_at: "2026-08-22T12:00:00Z",
  created_by_profile_id: "profile-1",
  updated_by_profile_id: "profile-1",
  created_by: null,
  updated_by: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }))
})

describe("TeamActivityDetail", () => {
  it("deletes through the authenticated API before navigating back to the diary", async () => {
    const user = userEvent.setup()
    render(<TeamActivityDetail activity={ACTIVITY} />)

    await user.click(screen.getByRole("button", { name: "Další akce" }))
    await user.click(await screen.findByRole("menuitem", { name: "Smazat" }))
    await user.click(await screen.findByRole("button", { name: "Odstranit" }))

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(
        "/api/tymovy-denik/activities/activity-1",
        {
          body: JSON.stringify({ expectedUpdatedAt: ACTIVITY.updated_at }),
          headers: { "content-type": "application/json" },
          method: "DELETE",
        },
      )
    })
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Akce odstraněna")
    expect(mocks.push).toHaveBeenCalledWith("/tymovy-denik")
  })

  it("stays on the detail and reports the server message when deletion fails", async () => {
    const user = userEvent.setup()
    mocks.fetch.mockResolvedValue(new Response(
      JSON.stringify({ error: "Akci mezitím upravil někdo další." }),
      { status: 409, headers: { "content-type": "application/json" } },
    ))
    render(<TeamActivityDetail activity={ACTIVITY} />)

    await user.click(screen.getByRole("button", { name: "Další akce" }))
    await user.click(await screen.findByRole("menuitem", { name: "Smazat" }))
    await user.click(await screen.findByRole("button", { name: "Odstranit" }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("Akci mezitím upravil někdo další.")
    })
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("renders structured attendees and highlighted reflection", () => {
    const activityWithAttendees: TeamActivityWithCreator = {
      ...ACTIVITY,
      reflection: "Skvělá týmová reflexe a poučení",
      attendees: [
        {
          id: "att-1",
          activity_id: ACTIVITY.id,
          profile_id: "prof-1",
          status: "present",
          profile: { id: "prof-1", name: "Aneta Nováková", picture: null, role: "student" },
        },
        {
          id: "att-2",
          activity_id: ACTIVITY.id,
          profile_id: "prof-2",
          status: "excused",
          profile: { id: "prof-2", name: "Karel Dvořák", picture: null, role: "student" },
        },
      ],
    }

    render(<TeamActivityDetail activity={activityWithAttendees} />)

    expect(screen.getByText("Skvělá týmová reflexe a poučení")).toBeInTheDocument()
    expect(screen.getByText("Aneta Nováková")).toBeInTheDocument()
    expect(screen.getByText("Karel Dvořák")).toBeInTheDocument()
    expect(screen.getByText(/Účast \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Omluven:a \(1\)/)).toBeInTheDocument()
  })
})

