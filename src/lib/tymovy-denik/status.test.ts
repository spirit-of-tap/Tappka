import { describe, expect, it } from "vitest"
import { getTeamActivityLoop, LOOP_LABELS } from "./status"

describe("getTeamActivityLoop", () => {
  it("flags an activity without reflection as missing reflection", () => {
    expect(getTeamActivityLoop({ reflection: null })).toBe("missing-reflection")
    expect(getTeamActivityLoop({ reflection: "  " })).toBe("missing-reflection")
  })

  it("returns null once the reflection is filled (calm archive)", () => {
    expect(getTeamActivityLoop({ reflection: "Silnější vazby" })).toBeNull()
  })

  it("has no undated state — occurred_at is NOT NULL", () => {
    expect(LOOP_LABELS["missing-reflection"]).toBe("Chybí reflexe")
  })
})
