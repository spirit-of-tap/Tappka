import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ActionStepsEditor } from "./action-steps-editor"
import type { ActionStepItem } from "@/lib/tymova-reflexe/action-steps"

const TEAM_MEMBERS = [
  { id: "m1", name: "Anna Nováková", picture: null, role: "member" as const },
  { id: "m2", name: "Petr Svoboda", picture: null, role: "member" as const },
]

describe("ActionStepsEditor", () => {
  it("renders empty state and calls onChange when clicking 'Přidat krok'", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<ActionStepsEditor steps={[]} onChange={onChange} teamMembers={TEAM_MEMBERS} />)

    expect(screen.getByText("Zatím nejsou naplánovány žádné akční kroky.")).toBeInTheDocument()

    // Click 'Přidat krok'
    const addButtons = screen.getAllByRole("button", { name: /Přidat krok|Vytvořit první akční krok/i })
    await user.click(addButtons[0])

    expect(onChange).toHaveBeenCalledTimes(1)
    const newSteps: ActionStepItem[] = onChange.mock.calls[0][0]
    expect(newSteps).toHaveLength(1)
    expect(newSteps[0].text).toBe("")
    expect(newSteps[0].assignee).toBe("")
  })

  it("renders list of existing steps and lets user edit description", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const initialSteps: ActionStepItem[] = [
      { id: "s1", text: "Zavolat zákazníkům", assignee: "Anna Nováková" },
    ]

    render(
      <ActionStepsEditor
        steps={initialSteps}
        onChange={onChange}
        teamMembers={TEAM_MEMBERS}
      />,
    )

    const textarea = screen.getByPlaceholderText("Co konkrétně uděláme (akční krok)…")
    expect(textarea).toHaveValue("Zavolat zákazníkům")

    await user.type(textarea, " dnes")

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].text).toContain("Zavolat zákazníkům")
  })

  it("calls onChange to remove step when clicking trash icon", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const initialSteps: ActionStepItem[] = [
      { id: "s1", text: "Krok 1", assignee: "Anna Nováková" },
      { id: "s2", text: "Krok 2", assignee: "Petr Svoboda" },
    ]

    render(
      <ActionStepsEditor
        steps={initialSteps}
        onChange={onChange}
        teamMembers={TEAM_MEMBERS}
      />,
    )

    const deleteButtons = screen.getAllByLabelText("Smazat akční krok")
    expect(deleteButtons).toHaveLength(2)

    await user.click(deleteButtons[0])

    expect(onChange).toHaveBeenCalledWith([{ id: "s2", text: "Krok 2", assignee: "Petr Svoboda" }])
  })
})
