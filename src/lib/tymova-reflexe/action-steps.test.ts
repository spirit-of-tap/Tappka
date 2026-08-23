import { describe, expect, it } from "vitest"
import { parseActionSteps, serializeActionSteps } from "./action-steps"

describe("parseActionSteps", () => {
  it("returns empty array for empty or whitespace string", () => {
    expect(parseActionSteps(null, null)).toEqual([])
    expect(parseActionSteps("", "")).toEqual([])
    expect(parseActionSteps("   ", null)).toEqual([])
  })

  it("parses JSON format correctly", () => {
    const raw = JSON.stringify([
      { id: "1", text: "Dodělat web", assignee: "Karel" },
      { id: "2", text: "Kontaktovat kouče", assignee: "Lucie" },
    ])
    const steps = parseActionSteps(raw, null)
    expect(steps).toHaveLength(2)
    expect(steps[0]).toEqual({ id: "1", text: "Dodělat web", assignee: "Karel" })
    expect(steps[1]).toEqual({ id: "2", text: "Kontaktovat kouče", assignee: "Lucie" })
  })

  it("parses legacy newline-separated plain text with bullet points", () => {
    const raw = "• Krok 1\n- Krok 2\nKrok 3"
    const steps = parseActionSteps(raw, "Tým")
    expect(steps).toHaveLength(3)
    expect(steps[0].text).toBe("Krok 1")
    expect(steps[0].assignee).toBe("Tým")
    expect(steps[1].text).toBe("Krok 2")
    expect(steps[2].text).toBe("Krok 3")
  })
})

describe("serializeActionSteps", () => {
  it("serializes steps to JSON and responsible_person string", () => {
    const steps = [
      { id: "1", text: "Krok 1", assignee: "Anna" },
      { id: "2", text: "Krok 2", assignee: "Petr" },
      { id: "3", text: "Krok 3", assignee: "Anna" },
    ]
    const { planned_action_steps, responsible_person } = serializeActionSteps(steps)
    expect(responsible_person).toBe("Anna, Petr")
    expect(JSON.parse(planned_action_steps!)).toEqual([
      { id: "1", text: "Krok 1", assignee: "Anna" },
      { id: "2", text: "Krok 2", assignee: "Petr" },
      { id: "3", text: "Krok 3", assignee: "Anna" },
    ])
  })

  it("preserves newly added blank steps so they can be edited", () => {
    const steps = [{ id: "new-1", text: "", assignee: "" }]
    const { planned_action_steps, responsible_person } = serializeActionSteps(steps)
    expect(responsible_person).toBeNull()
    expect(JSON.parse(planned_action_steps!)).toEqual([
      { id: "new-1", text: "", assignee: "" },
    ])
  })

  it("returns nulls when steps array is completely empty", () => {
    expect(serializeActionSteps([])).toEqual({
      planned_action_steps: null,
      responsible_person: null,
    })
  })
})
