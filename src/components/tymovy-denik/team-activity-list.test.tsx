import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { TeamActivityList } from "./team-activity-list"
import type { TeamActivityWithCreator } from "@/lib/tymovy-denik/types"

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"

function activity(overrides: Partial<TeamActivityWithCreator>): TeamActivityWithCreator {
  return {
    id: "activity-1",
    team_id: "team-1",
    occurred_at: "2026-08-22",
    activity_type: "Výlet",
    participants: null,
    reason: null,
    reflection: "Hotovo",
    image_path: null,
    removed_at: null,
    created_at: "2026-08-22T12:00:00Z",
    updated_at: "2026-08-22T12:00:00Z",
    created_by_profile_id: "profile-1",
    updated_by_profile_id: "profile-1",
    created_by: null,
    updated_by: null,
    ...overrides,
  }
}

describe("TeamActivityList", () => {
  it("places the desktop create action immediately after the help action in the header", () => {
    render(<TeamActivityList activities={[]} />)

    expect(screen.getByRole("heading", { name: "Týmový deník" })).toBeInTheDocument()

    const helpButton = screen.getByRole("button", { name: "Co je týmový deník?" })
    const createButton = screen
      .getAllByRole("button", { name: "Nová akce" })
      .find((button) => button.classList.contains("sm:inline-flex"))

    expect(createButton).toBeDefined()
    expect(helpButton.nextElementSibling).toBe(createButton)
  })

  it("does not prioritize a photo below the first timeline entry", () => {
    const { container } = render(<TeamActivityList activities={[
      activity({ id: "newest", occurred_at: "2026-08-22" }),
      activity({
        id: "older-photo",
        occurred_at: "2026-08-21",
        image_path: "team-activities/team-1/photo.webp",
      }),
    ]} />)

    expect(container.querySelector("img")).toHaveAttribute("loading", "lazy")
  })
})
