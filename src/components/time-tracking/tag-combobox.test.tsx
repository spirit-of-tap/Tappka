import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { TagCatalog, TimeDirection, TimeTag } from "@/lib/time-tracking/types"

import { TagCombobox, newTagsLabel } from "./tag-combobox"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

// cmdk measures items with scrollIntoView, which jsdom lacks.
Element.prototype.scrollIntoView = vi.fn()

const TEAM_ID = "team-1"

function tag(id: string, name: string, direction: TimeDirection, teamId: string | null = TEAM_ID): TimeTag {
  return {
    id,
    name,
    direction,
    team_id: teamId,
    system_key: teamId === null ? id : null,
    created_by_profile_id: teamId === null ? null : "p1",
    updated_by_profile_id: teamId === null ? null : "p1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  }
}

const TS = tag("t-ts", "TS", "training", null)
const ESSAY = tag("t-essay", "Esej", "reading", null)
const READING = tag("t-reading", "Čtení", "reading", null)
const FELLA_PRACTISE = tag("t-fella-practise", "fellaship", "practise")
const FELLA_PROJECT = tag("t-fella-project", "fellaship", "project")
const HIDDEN_PROJECT = tag("t-tappka", "Tappka", "project")

function catalog(overrides: Partial<TagCatalog> = {}): TagCatalog {
  return {
    tags: [ESSAY, FELLA_PRACTISE, FELLA_PROJECT, HIDDEN_PROJECT, READING, TS],
    selectedTagIds: [FELLA_PRACTISE.id, FELLA_PROJECT.id],
    newTagCount: 0,
    ...overrides,
  }
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderCombobox(direction: TimeDirection | null, value: string | null = null, initial = catalog()) {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<TagCombobox value={value} direction={direction} onChange={onChange} initialCatalog={initial} />)
  return { onChange, user }
}

describe("TagCombobox", () => {
  it("is disabled until a direction is chosen", () => {
    renderCombobox(null)
    const trigger = screen.getByRole("combobox")
    expect(trigger).toBeDisabled()
    expect(trigger).toHaveTextContent("Nejdřív vyber směr")
  })

  it("offers only the fixed tags for Reading, without „Bez tagu“ or creating", async () => {
    const { user } = renderCombobox("reading")
    expect(screen.getByRole("combobox")).toHaveTextContent("Vyber tag")
    await user.click(screen.getByRole("combobox"))

    expect(screen.getByRole("option", { name: "Čtení" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Esej" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Bez tagu" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "fellaship" })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText("Hledat tag"), "Kniha")
    expect(screen.queryByText(/Vytvořit tag/)).not.toBeInTheDocument()
  })

  it("offers only shown team tags for Projekt", async () => {
    const { user } = renderCombobox("project")
    await user.click(screen.getByRole("combobox"))

    expect(screen.getByRole("option", { name: "Bez tagu" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "fellaship" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Tappka" })).not.toBeInTheDocument()
  })

  it("keeps a hidden tag listed when the entry already uses it", async () => {
    const { user } = renderCombobox("project", HIDDEN_PROJECT.id)
    expect(screen.getByRole("combobox")).toHaveTextContent("Tappka")
    await user.click(screen.getByRole("combobox"))

    expect(screen.getByRole("option", { name: "Tappka" })).toBeInTheDocument()
  })

  it("selects the tag of the matching direction when names repeat", async () => {
    const { onChange, user } = renderCombobox("project")
    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: "fellaship" }))

    expect(onChange).toHaveBeenCalledWith(FELLA_PROJECT.id, FELLA_PROJECT)
  })

  it("creates a new team tag under the current direction", async () => {
    const created = tag("t-new", "Kavárna", "project")
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: created }), { status: 201 }))
    const { onChange, user } = renderCombobox("project")

    await user.click(screen.getByRole("combobox"))
    await user.type(screen.getByLabelText("Hledat nebo vytvořit tag"), "Kavárna")
    await user.click(screen.getByText("Vytvořit tag „Kavárna“"))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("t-new", created))
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/time-tags",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Kavárna", direction: "project" }) }),
    )
  })

  it("shows a hidden team tag with the typed name instead of creating a duplicate", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }))
    const { onChange, user } = renderCombobox("project")

    await user.click(screen.getByRole("combobox"))
    await user.type(screen.getByLabelText("Hledat nebo vytvořit tag"), "tappka")
    expect(screen.queryByText(/Vytvořit tag/)).not.toBeInTheDocument()
    await user.click(screen.getByText("Zobrazit tag týmu „Tappka“"))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(HIDDEN_PROJECT.id, HIDDEN_PROJECT))
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/time-tags/${HIDDEN_PROJECT.id}/selection`,
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ selected: true }) }),
    )
  })

  it("announces new team tags with a link to the settings and lets them be ignored", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }))
    const { user } = renderCombobox("practise", null, catalog({ newTagCount: 3 }))
    await user.click(screen.getByRole("combobox"))

    expect(screen.getByRole("link", { name: "3 nové tagy" })).toHaveAttribute("href", "/settings/cas")
    await user.click(screen.getByRole("button", { name: "Ignorovat" }))

    expect(screen.queryByRole("link", { name: "3 nové tagy" })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/api/time-tags/review", expect.objectContaining({ method: "POST" }))
  })

  it("does not announce new team tags for Training", async () => {
    const { user } = renderCombobox("training", null, catalog({ newTagCount: 3 }))
    await user.click(screen.getByRole("combobox"))

    expect(screen.getByRole("option", { name: "TS" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "3 nové tagy" })).not.toBeInTheDocument()
  })
})

describe("newTagsLabel", () => {
  it.each([
    [1, "1 nový tag"],
    [3, "3 nové tagy"],
    [5, "5 nových tagů"],
  ])("%i → %s", (count, label) => {
    expect(newTagsLabel(count)).toBe(label)
  })
})
