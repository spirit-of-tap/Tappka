import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ToolsTechniquesTable } from "./tools-techniques-table"
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

const toolRow: ToolTechnique = {
  id: "t2",
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

describe("ToolsTechniquesTable", () => {
  it("renders one table with all rows and type badges", () => {
    render(<ToolsTechniquesTable items={[modelRow, toolRow]} profileId={PROFILE_ID} />)

    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Oblast" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Název" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Vlastní reflexe" })).toBeInTheDocument()
    expect(screen.getByText("SWOT")).toBeInTheDocument()
    expect(screen.getByText("Trello")).toBeInTheDocument()
    expect(screen.getByText("Používám ho při plánování projektu.")).toBeInTheDocument()
    expect(screen.getByText("Model")).toBeInTheDocument()
    expect(screen.getByText("Nástroj")).toBeInTheDocument()
  })

  it("creates a new record through the dialog form", async () => {
    const user = userEvent.setup()
    const createdRow = { ...modelRow, id: "t3", name: "SMART" }
    const single = vi.fn().mockResolvedValue({ data: createdRow, error: null })
    mockFrom.mockReturnValue({
      insert: () => ({ select: () => ({ single }) }),
    })

    render(<ToolsTechniquesTable items={[]} profileId={PROFILE_ID} />)

    const addButtons = screen.getAllByRole("button", { name: /Přidat záznam/i })
    await user.click(addButtons[0])

    await user.click(screen.getByRole("combobox", { name: /Oblast/i }))
    await user.click(await screen.findByRole("option", { name: /Model/i }))
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

  it("soft-deletes a record after confirmation", async () => {
    const user = userEvent.setup()
    const eq = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({
      update: () => ({ eq }),
    })

    render(<ToolsTechniquesTable items={[modelRow]} profileId={PROFILE_ID} />)

    await user.click(screen.getByRole("button", { name: /Odstranit SWOT/i }))
    await user.click(screen.getByRole("button", { name: "Odstranit" }))

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("tools_techniques")
      expect(eq).toHaveBeenCalledWith("id", "t1")
    })
    await waitFor(() => expect(screen.queryByText("SWOT")).not.toBeInTheDocument())
  })
})
