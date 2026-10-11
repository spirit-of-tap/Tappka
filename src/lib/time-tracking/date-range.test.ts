import { describe, expect, it } from "vitest"

import {
  EMPTY_SELECTION,
  MAX_RANGE_DAYS,
  addDaysToKey,
  clampRange,
  clickDay,
  highlightedRange,
  matchPreset,
  parseRangeParams,
  presetRange,
  rangeDayCount,
  rangeToInstants,
  scaleWeeklyTarget,
  shiftRange,
  todayKeyOf,
} from "./date-range"

// Friday 9. 10. 2026.
const TODAY = "2026-10-09"

describe("presetRange", () => {
  it.each([
    ["today", "2026-10-09", "2026-10-09"],
    ["yesterday", "2026-10-08", "2026-10-08"],
    ["this-week", "2026-10-05", "2026-10-11"],
    ["last-week", "2026-09-28", "2026-10-04"],
    ["past-two-weeks", "2026-09-28", "2026-10-11"],
    ["this-month", "2026-10-01", "2026-10-31"],
    ["last-month", "2026-09-01", "2026-09-30"],
    ["this-year", "2026-01-01", "2026-12-31"],
    ["last-year", "2025-01-01", "2025-12-31"],
  ] as const)("%s → %s – %s", (id, from, to) => {
    expect(presetRange(id, TODAY)).toEqual({ from, to })
  })

  it("treats Sunday as the end of the Monday-first week", () => {
    expect(presetRange("this-week", "2026-10-11")).toEqual({ from: "2026-10-05", to: "2026-10-11" })
    expect(presetRange("this-week", "2026-10-12")).toEqual({ from: "2026-10-12", to: "2026-10-18" })
  })

  it("crosses year boundaries", () => {
    expect(presetRange("last-month", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" })
    expect(presetRange("yesterday", "2026-01-01")).toEqual({ from: "2025-12-31", to: "2025-12-31" })
    expect(presetRange("this-week", "2026-01-01")).toEqual({ from: "2025-12-29", to: "2026-01-04" })
  })

  it("knows month lengths incl. leap years", () => {
    expect(presetRange("last-month", "2028-03-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" })
    expect(presetRange("last-month", "2026-03-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" })
  })
})

describe("matchPreset", () => {
  it("recognises preset ranges and returns null for custom ones", () => {
    expect(matchPreset({ from: "2026-10-05", to: "2026-10-11" }, TODAY)).toBe("this-week")
    expect(matchPreset({ from: "2026-10-01", to: "2026-10-31" }, TODAY)).toBe("this-month")
    expect(matchPreset({ from: "2026-10-09", to: "2026-10-09" }, TODAY)).toBe("today")
    expect(matchPreset({ from: "2026-10-06", to: "2026-10-11" }, TODAY)).toBeNull()
  })
})

describe("shiftRange", () => {
  it("moves weeks, days and custom ranges by their length", () => {
    expect(shiftRange({ from: "2026-10-05", to: "2026-10-11" }, -1)).toEqual({ from: "2026-09-28", to: "2026-10-04" })
    expect(shiftRange({ from: "2026-10-09", to: "2026-10-09" }, 1)).toEqual({ from: "2026-10-10", to: "2026-10-10" })
    expect(shiftRange({ from: "2026-10-07", to: "2026-10-09" }, -1)).toEqual({ from: "2026-10-04", to: "2026-10-06" })
    expect(shiftRange({ from: "2026-09-28", to: "2026-10-11" }, -1)).toEqual({ from: "2026-09-14", to: "2026-09-27" })
  })

  it("moves whole months by months so month lengths stay right", () => {
    expect(shiftRange({ from: "2026-01-01", to: "2026-01-31" }, 1)).toEqual({ from: "2026-02-01", to: "2026-02-28" })
    expect(shiftRange({ from: "2028-03-01", to: "2028-03-31" }, -1)).toEqual({ from: "2028-02-01", to: "2028-02-29" })
    expect(shiftRange({ from: "2026-12-01", to: "2026-12-31" }, 1)).toEqual({ from: "2027-01-01", to: "2027-01-31" })
    expect(shiftRange({ from: "2026-01-01", to: "2026-03-31" }, 1)).toEqual({ from: "2026-04-01", to: "2026-06-30" })
  })

  it("moves whole years by years", () => {
    expect(shiftRange({ from: "2026-01-01", to: "2026-12-31" }, -1)).toEqual({ from: "2025-01-01", to: "2025-12-31" })
    expect(shiftRange({ from: "2027-01-01", to: "2027-12-31" }, 1)).toEqual({ from: "2028-01-01", to: "2028-12-31" })
  })

  it("is reversible", () => {
    const ranges = [
      { from: "2026-10-05", to: "2026-10-11" },
      { from: "2026-02-01", to: "2026-02-28" },
      { from: "2026-10-15", to: "2026-10-31" },
    ]
    for (const range of ranges) expect(shiftRange(shiftRange(range, 1), -1)).toEqual(range)
  })
})

describe("parseRangeParams", () => {
  const thisWeek = { from: "2026-10-05", to: "2026-10-11" }

  it("accepts a valid pair", () => {
    expect(parseRangeParams("2026-08-01", "2026-08-31", TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-31" })
    expect(parseRangeParams(["2026-08-01"], ["2026-08-02"], TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-02" })
  })

  it("swaps a reversed pair", () => {
    expect(parseRangeParams("2026-08-31", "2026-08-01", TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-31" })
  })

  it("cuts overly long ranges to the maximum length from their start", () => {
    const range = parseRangeParams("2020-01-01", "2026-01-01", TODAY)
    expect(range.from).toBe("2020-01-01")
    expect(rangeDayCount(range)).toBe(MAX_RANGE_DAYS)
  })

  it("falls back to the current week for missing or invalid values", () => {
    expect(parseRangeParams(undefined, undefined, TODAY)).toEqual(thisWeek)
    expect(parseRangeParams("2026-08-01", undefined, TODAY)).toEqual(thisWeek)
    expect(parseRangeParams("nonsense", "2026-08-01", TODAY)).toEqual(thisWeek)
    expect(parseRangeParams("2026-02-30", "2026-03-01", TODAY)).toEqual(thisWeek)
  })

  it("accepts exactly the maximum length", () => {
    const from = "2025-01-01"
    const to = addDaysToKey(from, MAX_RANGE_DAYS - 1)
    expect(rangeDayCount(parseRangeParams(from, to, TODAY))).toBe(MAX_RANGE_DAYS)
  })
})

describe("clampRange", () => {
  it("keeps short ranges and cuts long ones from their start", () => {
    const short = { from: "2026-01-01", to: "2026-12-31" }
    expect(clampRange(short)).toBe(short)
    expect(clampRange({ from: "2023-01-01", to: "2026-03-01" })).toEqual({
      from: "2023-01-01",
      to: addDaysToKey("2023-01-01", MAX_RANGE_DAYS - 1),
    })
  })
})

describe("rangeToInstants", () => {
  it("spans Prague midnights, `to` exclusive", () => {
    expect(rangeToInstants({ from: "2026-10-05", to: "2026-10-11" })).toEqual({
      from: new Date("2026-10-04T22:00:00Z"),
      to: new Date("2026-10-11T22:00:00Z"),
    })
  })

  it("handles the autumn DST change (25 h day)", () => {
    const { from, to } = rangeToInstants({ from: "2026-10-25", to: "2026-10-25" })
    expect(from.toISOString()).toBe("2026-10-24T22:00:00.000Z")
    expect(to.toISOString()).toBe("2026-10-25T23:00:00.000Z")
  })

  it("round-trips with todayKeyOf around midnight", () => {
    expect(todayKeyOf(new Date("2026-10-09T21:59:59Z"))).toBe("2026-10-09")
    expect(todayKeyOf(new Date("2026-10-09T22:00:00Z"))).toBe("2026-10-10")
  })
})

describe("clickDay", () => {
  it("first click sets the start, a later click completes the range", () => {
    const first = clickDay(EMPTY_SELECTION, "2026-10-14")
    expect(first).toEqual({ selection: { anchor: "2026-10-14" }, completed: null })

    const second = clickDay(first.selection, "2026-10-21")
    expect(second).toEqual({ selection: EMPTY_SELECTION, completed: { from: "2026-10-14", to: "2026-10-21" } })
  })

  it("clicking the same day twice selects that single day", () => {
    const first = clickDay(EMPTY_SELECTION, "2026-10-14")
    expect(clickDay(first.selection, "2026-10-14").completed).toEqual({ from: "2026-10-14", to: "2026-10-14" })
  })

  it("an earlier second click moves the start instead of reversing the range", () => {
    const first = clickDay(EMPTY_SELECTION, "2026-10-21")
    const second = clickDay(first.selection, "2026-10-14")
    expect(second).toEqual({ selection: { anchor: "2026-10-14" }, completed: null })

    const third = clickDay(second.selection, "2026-10-16")
    expect(third.completed).toEqual({ from: "2026-10-14", to: "2026-10-16" })
  })

  it("starts over after a completed range", () => {
    const done = clickDay(clickDay(EMPTY_SELECTION, "2026-10-01").selection, "2026-10-05")
    expect(clickDay(done.selection, "2026-09-01")).toEqual({ selection: { anchor: "2026-09-01" }, completed: null })
  })

  it("works across months and years", () => {
    const first = clickDay(EMPTY_SELECTION, "2025-12-30")
    expect(clickDay(first.selection, "2026-01-02").completed).toEqual({ from: "2025-12-30", to: "2026-01-02" })
  })
})

describe("highlightedRange", () => {
  const applied = { from: "2026-10-05", to: "2026-10-11" }

  it("shows the applied range when not picking", () => {
    expect(highlightedRange(EMPTY_SELECTION, "2026-10-20", applied)).toEqual(applied)
  })

  it("previews anchor → hovered day while picking", () => {
    const selection = { anchor: "2026-10-14" }
    expect(highlightedRange(selection, "2026-11-03", applied)).toEqual({ from: "2026-10-14", to: "2026-11-03" })
    expect(highlightedRange(selection, null, applied)).toEqual({ from: "2026-10-14", to: "2026-10-14" })
    expect(highlightedRange(selection, "2026-10-01", applied)).toEqual({ from: "2026-10-14", to: "2026-10-14" })
  })
})

describe("scaleWeeklyTarget", () => {
  it("scales a weekly goal by the number of days", () => {
    expect(scaleWeeklyTarget(40, { from: "2026-10-05", to: "2026-10-11" })).toBe(40)
    expect(scaleWeeklyTarget(40, { from: "2026-09-28", to: "2026-10-11" })).toBe(80)
    expect(scaleWeeklyTarget(40, { from: "2026-09-01", to: "2026-09-30" })).toBe(171.4)
    expect(scaleWeeklyTarget(40, { from: "2026-10-09", to: "2026-10-09" })).toBe(5.7)
  })
})
