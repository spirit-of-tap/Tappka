import { describe, expect, it } from "vitest"

import { hasMissingReflection } from "./reflections"

function session(startsAt: string, overrides: { cancelled_at?: string | null } = {}) {
  return { id: "s1", starts_at: startsAt, cancelled_at: overrides.cancelled_at ?? null }
}

describe("hasMissingReflection", () => {
  it("nudges for a session on the cutoff date", () => {
    expect(hasMissingReflection(session("2026-11-04T08:00:00Z"), new Set())).toBe(true)
  })

  it("nudges for a session after the cutoff date", () => {
    expect(hasMissingReflection(session("2026-11-10T08:00:00Z"), new Set())).toBe(true)
  })

  it("stays quiet for a session from the day before", () => {
    expect(hasMissingReflection(session("2026-11-03T22:59:00Z"), new Set())).toBe(false)
  })

  it("counts the Prague date, not the UTC date", () => {
    // 00:30 on 4 November in Prague is still 3 November in UTC.
    expect(hasMissingReflection(session("2026-11-03T23:30:00Z"), new Set())).toBe(true)
  })

  it("stays quiet for a cancelled session", () => {
    expect(hasMissingReflection(session("2026-11-10T08:00:00Z", { cancelled_at: "2026-11-01T08:00:00Z" }), new Set())).toBe(false)
  })

  it("stays quiet once the reflection exists", () => {
    expect(hasMissingReflection(session("2026-11-10T08:00:00Z"), new Set(["s1"]))).toBe(false)
  })
})
