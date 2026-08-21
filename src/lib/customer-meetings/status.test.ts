import { describe, expect, it } from "vitest"
import { getMeetingLoop, LOOP_LABELS } from "./status"

const NOW = new Date(2026, 4, 15, 12, 0)

function meeting(overrides: { meetingAt?: string | null; postMortem?: string | null }) {
  return { meeting_at: overrides.meetingAt ?? null, post_mortem: overrides.postMortem ?? null }
}

describe("getMeetingLoop", () => {
  it("flags a past meeting without post-mortem as missing follow-up", () => {
    expect(getMeetingLoop(meeting({ meetingAt: "2026-05-10T09:00:00Z" }), NOW)).toBe(
      "missing-follow-up",
    )
  })

  it("treats an empty-string post-mortem as missing", () => {
    expect(
      getMeetingLoop(meeting({ meetingAt: "2026-05-10T09:00:00Z", postMortem: "  " }), NOW),
    ).toBe("missing-follow-up")
  })

  it("returns null once the post-mortem is filled (calm archive)", () => {
    expect(
      getMeetingLoop(meeting({ meetingAt: "2026-05-10T09:00:00Z", postMortem: "Reflexe" }), NOW),
    ).toBeNull()
  })

  it("flags a future-dated meeting as planned even without post-mortem", () => {
    expect(getMeetingLoop(meeting({ meetingAt: "2026-06-01T09:00:00Z" }), NOW)).toBe("planned")
  })

  it("returns undated for meetings without a date", () => {
    expect(getMeetingLoop(meeting({}), NOW)).toBe("undated")
    expect(LOOP_LABELS.undated).toBe("Bez data")
  })
})
