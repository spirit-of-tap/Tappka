import { describe, expect, it } from "vitest"
import { getMeetingLoop, LOOP_LABELS } from "./status"

function meeting(overrides: { meetingAt?: string | null; postMortem?: string | null }) {
  return { meeting_at: overrides.meetingAt ?? null, post_mortem: overrides.postMortem ?? null }
}

describe("getMeetingLoop", () => {
  it("flags a past meeting without post-mortem as missing follow-up", () => {
    expect(getMeetingLoop(meeting({ meetingAt: "2026-05-10T09:00:00Z" }))).toBe(
      "missing-follow-up",
    )
  })

  it("treats an empty-string post-mortem as missing", () => {
    expect(getMeetingLoop(meeting({ meetingAt: "2026-05-10T09:00:00Z", postMortem: "  " }))).toBe(
      "missing-follow-up",
    )
  })

  it("returns null once the post-mortem is filled (calm archive)", () => {
    expect(
      getMeetingLoop(meeting({ meetingAt: "2026-05-10T09:00:00Z", postMortem: "Reflexe" })),
    ).toBeNull()
  })

  it("returns undated for meetings without a date", () => {
    expect(getMeetingLoop(meeting({}))).toBe("undated")
    expect(LOOP_LABELS.undated).toBe("Bez data")
    expect(LOOP_LABELS["missing-follow-up"]).toBe("Chybí follow-up")
  })

  it("treats a future-dated entry (should not exist; form constrains it) as an open loop", () => {
    // Meetings cannot be planned ahead — the form rejects future dates. If one
    // slips in (legacy data), it is simply a meeting without follow-up yet.
    expect(getMeetingLoop(meeting({ meetingAt: "2027-01-01T09:00:00Z" }))).toBe(
      "missing-follow-up",
    )
  })
})
