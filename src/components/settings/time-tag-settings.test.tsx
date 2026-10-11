import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { TimeDirection, TimeTag } from "@/lib/time-tracking/types"

import { TimeTagSettings } from "./time-tag-settings"

const toastError = vi.fn()

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: (...args: unknown[]) => toastError(...args) }),
}))

const ME = "p-me"

function tag(id: string, name: string, direction: TimeDirection, createdAt = "2026-09-01T00:00:00Z"): TimeTag {
  const system = direction === "training" || direction === "reading"
  return {
    id,
    name,
    direction,
    team_id: system ? null : "team-1",
    system_key: system ? id : null,
    created_by_profile_id: system ? null : "p-other",
    updated_by_profile_id: system ? null : "p-other",
    created_at: createdAt,
    updated_at: createdAt,
  }
}

const TAGS = [
  tag("ts", "TS", "training"),
  tag("essay", "Esej", "reading"),
  tag("fella", "Fellaship", "practise"),
  tag("cafe", "Kavárna", "practise", "2026-10-05T00:00:00Z"),
]

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }))
  toastError.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderSettings(overrides: Partial<React.ComponentProps<typeof TimeTagSettings>> = {}) {
  render(
    <TimeTagSettings
      tags={TAGS}
      selectedTagIds={["fella"]}
      reviewedAt="2026-10-01T00:00:00Z"
      newTagCount={1}
      profileId={ME}
      hasTeam
      {...overrides}
    />,
  )
}

describe("TimeTagSettings", () => {
  it("lists team tags with switches, marks new ones and shows fixed tags read-only", () => {
    renderSettings()

    expect(screen.getByRole("switch", { name: "Fellaship" })).toBeChecked()
    expect(screen.getByRole("switch", { name: /Kavárna/ })).not.toBeChecked()
    expect(screen.getByText("Nový")).toBeInTheDocument()
    expect(screen.getByText("Tým zatím nemá žádný tag. Založíš ho při zapisování času.")).toBeInTheDocument()

    const fixed = screen.getByRole("region", { name: "Training a Reading" })
    expect(within(fixed).getByText("TS")).toBeInTheDocument()
    expect(within(fixed).getByText("Esej")).toBeInTheDocument()
    expect(within(fixed).queryByRole("switch")).not.toBeInTheDocument()
  })

  it("marks the tags as reviewed when there is something new", async () => {
    renderSettings()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/time-tags/review", expect.objectContaining({ method: "POST" })),
    )
  })

  it("does not write a review when nothing is new", () => {
    renderSettings({ newTagCount: 0 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows a tag via the selection endpoint", async () => {
    const user = userEvent.setup()
    renderSettings({ newTagCount: 0 })

    await user.click(screen.getByRole("switch", { name: /Kavárna/ }))

    expect(screen.getByRole("switch", { name: /Kavárna/ })).toBeChecked()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/time-tags/cafe/selection",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ selected: true }) }),
    )
  })

  it("reverts the switch when saving fails", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "x" }), { status: 500 }))
    const user = userEvent.setup()
    renderSettings({ newTagCount: 0 })

    await user.click(screen.getByRole("switch", { name: "Fellaship" }))

    await waitFor(() => expect(screen.getByRole("switch", { name: "Fellaship" })).toBeChecked())
    expect(toastError).toHaveBeenCalled()
  })

  it("explains team tags to someone without a team", () => {
    renderSettings({ hasTeam: false, selectedTagIds: [], tags: TAGS.filter((t) => t.team_id === null) })
    expect(screen.getByText("Nejsi v žádném týmu")).toBeInTheDocument()
  })
})
