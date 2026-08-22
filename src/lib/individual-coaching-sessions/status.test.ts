import { describe, expect, it } from "vitest"
import { getCoachingSessionLoop, LOOP_LABELS } from "./status"

function session(overrides: { sessionAt?: string | null; keyTakeaways?: string | null }) {
  return { session_at: overrides.sessionAt ?? null, key_takeaways: overrides.keyTakeaways ?? null }
}

describe("getCoachingSessionLoop", () => {
  it("flags a dated session without takeaways as missing notes", () => {
    expect(getCoachingSessionLoop(session({ sessionAt: "2026-05-12T09:00:00Z" }))).toBe(
      "missing-notes",
    )
  })

  it("treats an empty-string takeaways field as missing", () => {
    expect(getCoachingSessionLoop(session({ sessionAt: "2026-05-12T09:00:00Z", keyTakeaways: "  " }))).toBe(
      "missing-notes",
    )
  })

  it("returns null once takeaways are filled (calm archive)", () => {
    expect(
      getCoachingSessionLoop(session({ sessionAt: "2026-05-12T09:00:00Z", keyTakeaways: "Insight" })),
    ).toBeNull()
  })

  it("returns undated for sessions without a date", () => {
    expect(getCoachingSessionLoop(session({}))).toBe("undated")
    expect(LOOP_LABELS.undated).toBe("Bez data")
    expect(LOOP_LABELS["missing-notes"]).toBe("Chybí poznámky")
  })

  it("treats a future-dated entry (should not exist; form constrains it) as an open loop", () => {
    // Sessions cannot be planned ahead — the form rejects future dates. If one
    // slips in (legacy data), it is simply a session without notes yet.
    expect(getCoachingSessionLoop(session({ sessionAt: "2027-01-01T09:00:00Z" }))).toBe(
      "missing-notes",
    )
  })
})
