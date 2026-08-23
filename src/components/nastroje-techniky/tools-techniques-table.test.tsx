import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ToolsTechniquesView } from "./tools-techniques-view"
import type { ToolTechnique } from "@/lib/nastroje-techniky/types"

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}))

const PROFILE_ID = "profile-1"

const modelRow: ToolTechnique = {
  id: "t1",
  profile_id: PROFILE_ID,
  tool_type: "model",
  name: "SWOT",
  reflection: "Používám ho při plánování projektu.",
  removed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  created_by_profile_id: PROFILE_ID,
  updated_by_profile_id: PROFILE_ID,
}

const techniqueRow: ToolTechnique = {
  id: "t2",
  profile_id: PROFILE_ID,
  tool_type: "technique",
  name: "Brainstorming",
  reflection: "Generování nápadů v týmu.",
  removed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  created_by_profile_id: PROFILE_ID,
  updated_by_profile_id: PROFILE_ID,
}

const toolRow: ToolTechnique = {
  id: "t3",
  profile_id: PROFILE_ID,
  tool_type: "tool",
  name: "Trello",
  reflection: "Řídím s ním týmové úkoly.",
  removed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  created_by_profile_id: PROFILE_ID,
  updated_by_profile_id: PROFILE_ID,
}

beforeEach(() => {
  mockFrom.mockReset()
})

describe("ToolsTechniquesView", () => {
  it("renders items grouped by type in sections", () => {
    render(
      <ToolsTechniquesView
        items={[modelRow, techniqueRow, toolRow]}
        profileId={PROFILE_ID}
      />
    )

    // Check section headings
    expect(screen.getByRole("heading", { name: "Modely" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Techniky" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Nástroje" })).toBeInTheDocument()

    // Check item names & reflections
    expect(screen.getByText("SWOT")).toBeInTheDocument()
    expect(screen.getByText("Používám ho při plánování projektu.")).toBeInTheDocument()
    expect(screen.getByText("Brainstorming")).toBeInTheDocument()
    expect(screen.getByText("Generování nápadů v týmu.")).toBeInTheDocument()
    expect(screen.getByText("Trello")).toBeInTheDocument()
    expect(screen.getByText("Řídím s ním týmové úkoly.")).toBeInTheDocument()
  })

  it("filters items by badge filters", async () => {
    const user = userEvent.setup()
    render(
      <ToolsTechniquesView
        items={[modelRow, techniqueRow, toolRow]}
        profileId={PROFILE_ID}
      />
    )

    // Click on Modely badge filter
    const filterGroup = screen.getByRole("group", { name: /Filtrovat podle oblasti/i })
    await user.click(within(filterGroup).getByText(/^Modely/i))

    expect(screen.getByText("SWOT")).toBeInTheDocument()
    expect(screen.queryByText("Brainstorming")).not.toBeInTheDocument()
    expect(screen.queryByText("Trello")).not.toBeInTheDocument()
  })

  it("filters items by search input", async () => {
    const user = userEvent.setup()
    render(
      <ToolsTechniquesView
        items={[modelRow, techniqueRow, toolRow]}
        profileId={PROFILE_ID}
      />
    )

    const searchInput = screen.getByLabelText(/Hledat záznam/i)
    await user.type(searchInput, "Trello")

    expect(screen.getByText("Trello")).toBeInTheDocument()
    expect(screen.queryByText("SWOT")).not.toBeInTheDocument()
    expect(screen.queryByText("Brainstorming")).not.toBeInTheDocument()
  })

  it("creates a new record through the dialog form", async () => {
    const user = userEvent.setup()
    const createdRow = { ...modelRow, id: "t4", name: "SMART" }
    const single = vi.fn().mockResolvedValue({ data: createdRow, error: null })
    mockFrom.mockReturnValue({
      insert: () => ({ select: () => ({ single }) }),
    })

    render(<ToolsTechniquesView items={[]} profileId={PROFILE_ID} />)

    const addButtons = screen.getAllByRole("button", { name: /Přidat záznam/i })
    await user.click(addButtons[0])

    await user.click(screen.getByRole("combobox", { name: /Oblast/i }))
    await user.click(await screen.findByRole("option", { name: /^Model$/i }))
    await user.type(screen.getByLabelText(/Název/i), "SMART")
    await user.type(screen.getByLabelText(/Vlastní reflexe/i), "Cíle si píšu podle něj.")
    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Přidat záznam" }))

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("tools_techniques")
      expect(single).toHaveBeenCalled()
    })
    expect(await screen.findByText("SMART")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("updates an existing record through the edit dialog", async () => {
    const user = userEvent.setup()
    const updatedRow = { ...modelRow, reflection: "Nová aktualizovaná reflexe." }
    const single = vi.fn().mockResolvedValue({ data: updatedRow, error: null })
    mockFrom.mockReturnValue({
      update: () => ({ eq: () => ({ select: () => ({ single }) }) }),
    })

    render(<ToolsTechniquesView items={[modelRow]} profileId={PROFILE_ID} />)

    await user.click(screen.getByRole("button", { name: /Upravit SWOT/i }))
    const dialog = screen.getByRole("dialog")
    const reflectionInput = within(dialog).getByLabelText(/Vlastní reflexe/i)
    await user.clear(reflectionInput)
    await user.type(reflectionInput, "Nová aktualizovaná reflexe.")
    await user.click(within(dialog).getByRole("button", { name: "Uložit změny" }))

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("tools_techniques")
      expect(single).toHaveBeenCalled()
    })
    expect(await screen.findByText("Nová aktualizovaná reflexe.")).toBeInTheDocument()
  })

  it("soft-deletes a record after confirmation", async () => {
    const user = userEvent.setup()
    const eq = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({
      update: () => ({ eq }),
    })

    render(<ToolsTechniquesView items={[modelRow]} profileId={PROFILE_ID} />)

    await user.click(screen.getByRole("button", { name: /Odstranit SWOT/i }))
    await user.click(screen.getByRole("button", { name: "Odstranit" }))

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("tools_techniques")
      expect(eq).toHaveBeenCalledWith("id", "t1")
    })
    await waitFor(() => expect(screen.queryByText("SWOT")).not.toBeInTheDocument())
  })
})

