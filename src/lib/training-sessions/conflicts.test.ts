import { describe, expect, it } from "vitest"

import { findConflicts } from "./conflicts"

const mine = { id: "a", startsAt: "2026-10-07T06:00:00Z", endsAt: "2026-10-07T10:00:00Z", cancelledAt: null }

describe("findConflicts", () => {
  it("returns the overlapping interval", () => {
    const candidate = { id: "b", startsAt: "2026-10-07T08:00:00Z", endsAt: "2026-10-07T12:00:00Z", cancelledAt: null }
    expect(findConflicts(candidate, [mine])).toEqual([
      { commitment: mine, overlapStart: "2026-10-07T08:00:00Z", overlapEnd: "2026-10-07T10:00:00Z" },
    ])
  })
  it("treats touching intervals as no conflict", () => {
    const candidate = { id: "b", startsAt: "2026-10-07T10:00:00Z", endsAt: "2026-10-07T12:00:00Z", cancelledAt: null }
    expect(findConflicts(candidate, [mine])).toEqual([])
  })
  it("ignores the same session and cancelled commitments", () => {
    expect(findConflicts(mine, [mine])).toEqual([])
    const cancelled = { ...mine, id: "c", cancelledAt: "2026-10-01T00:00:00Z" }
    const candidate = { id: "b", startsAt: "2026-10-07T08:00:00Z", endsAt: "2026-10-07T09:00:00Z", cancelledAt: null }
    expect(findConflicts(candidate, [cancelled])).toEqual([])
  })
  it("returns nothing for a cancelled candidate", () => {
    const candidate = { id: "b", startsAt: "2026-10-07T08:00:00Z", endsAt: "2026-10-07T09:00:00Z", cancelledAt: "2026-10-01T00:00:00Z" }
    expect(findConflicts(candidate, [mine])).toEqual([])
  })
})
