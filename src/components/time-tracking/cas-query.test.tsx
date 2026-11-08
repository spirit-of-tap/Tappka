import { describe, expect, it } from "vitest"

import { presetRange, semesterRange } from "@/lib/time-tracking/date-range"

import { resolveRangeParams, withRangeParams } from "./cas-query"

const TODAY = "2026-11-08"

describe("resolveRangeParams", () => {
  it("uses the page default when params are missing", () => {
    const { range } = resolveRangeParams({}, new Date("2026-11-08T10:00:00Z"), semesterRange)
    expect(range).toEqual({ from: "2026-09-01", to: "2027-01-31" })
  })

  it("keeps the current week as the default without a page default", () => {
    const { range } = resolveRangeParams({}, new Date("2026-11-08T10:00:00Z"))
    expect(range).toEqual(presetRange("this-week", TODAY))
  })
})

describe("withRangeParams", () => {
  it("keeps this week explicit when the page default is the semester", () => {
    const week = presetRange("this-week", TODAY)
    const params = withRangeParams(new URLSearchParams(), week, TODAY, semesterRange(TODAY))
    expect(params.get("from")).toBe(week.from)
    expect(params.get("to")).toBe(week.to)
  })

  it("drops params for the page default", () => {
    const semester = semesterRange(TODAY)
    expect(withRangeParams(new URLSearchParams(), semester, TODAY, semester).toString()).toBe("")
  })
})
