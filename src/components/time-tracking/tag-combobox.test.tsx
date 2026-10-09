import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { TimeDirection, TimeTag } from "@/lib/time-tracking/types"

import { TagCombobox } from "./tag-combobox"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

// cmdk measures items with scrollIntoView, which jsdom lacks.
Element.prototype.scrollIntoView = vi.fn()

function tag(id: string, name: string, direction: TimeDirection): TimeTag {
  return {
    id,
    name,
    direction,
    profile_id: "p1",
    created_by_profile_id: "p1",
    updated_by_profile_id: "p1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  }
}

const TAGS = [
  tag("t-fella-practise", "fellaship", "practise"),
  tag("t-fella-project", "fellaship", "project"),
  tag("t-book", "Lean Startup", "reading"),
]

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderCombobox(direction: TimeDirection | null, value: string | null = null) {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<TagCombobox value={value} direction={direction} onChange={onChange} initialTags={TAGS} />)
  return { onChange, user }
}

describe("TagCombobox", () => {
  it("is disabled until a direction is chosen", () => {
    renderCombobox(null)
    const trigger = screen.getByRole("combobox")
    expect(trigger).toBeDisabled()
    expect(trigger).toHaveTextContent("Nejdřív vyber směr")
  })

  it("offers only tags of the entry's direction", async () => {
    const { user } = renderCombobox("reading")
    await user.click(screen.getByRole("combobox"))

    expect(screen.getByRole("option", { name: "Lean Startup" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "fellaship" })).not.toBeInTheDocument()
  })

  it("selects the tag of the matching direction when names repeat", async () => {
    const { onChange, user } = renderCombobox("project")
    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "fellaship" }))

    expect(onChange).toHaveBeenCalledWith("t-fella-project", TAGS[1])
  })

  it("creates a new tag under the current direction", async () => {
    const created = tag("t-new", "Tappka", "project")
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: created }), { status: 201 }))
    const { onChange, user } = renderCombobox("project")

    await user.click(screen.getByRole("combobox"))
    await user.type(screen.getByLabelText("Hledat nebo vytvořit tag"), "Tappka")
    await user.click(screen.getByText("Vytvořit tag „Tappka“"))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("t-new", created))
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/time-tags",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Tappka", direction: "project" }) }),
    )
  })

  it("allows creating a name that exists only under another direction", async () => {
    const { user } = renderCombobox("reading")
    await user.click(screen.getByRole("combobox"))
    await user.type(screen.getByLabelText("Hledat nebo vytvořit tag"), "fellaship")

    expect(screen.getByText("Vytvořit tag „fellaship“")).toBeInTheDocument()
  })
})
