import { describe, expect, it } from "vitest"

import { getSessionStatus } from "./status"

const base = { startsAt: "2026-10-06T06:00:00.000Z", endsAt: "2026-10-06T10:00:00.000Z", cancelledAt: null }

describe("getSessionStatus", () => {
  it("is upcoming before start", () => {
    expect(getSessionStatus(base, new Date("2026-10-06T05:59:00Z"))).toBe("upcoming")
  })
  it("is ongoing between start and end", () => {
    expect(getSessionStatus(base, new Date("2026-10-06T06:00:00Z"))).toBe("ongoing")
  })
  it("is past at end", () => {
    expect(getSessionStatus(base, new Date("2026-10-06T10:00:00Z"))).toBe("past")
  })
  it("is cancelled regardless of time", () => {
    expect(getSessionStatus({ ...base, cancelledAt: "2026-10-01T00:00:00Z" }, new Date("2026-10-06T07:00:00Z"))).toBe("cancelled")
  })
})
