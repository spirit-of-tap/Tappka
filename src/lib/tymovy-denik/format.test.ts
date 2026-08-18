import { describe, expect, it } from "vitest"
import {
  formatActivityDate,
  getActivityMonthKey,
  getActivityMonthLabel,
} from "./format"

describe("team activity format helpers", () => {
  it("formats a date as day. month. year", () => {
    expect(formatActivityDate("2026-03-12")).toBe("12. 3. 2026")
  })

  it("strips leading zeros from single-digit day and month", () => {
    expect(formatActivityDate("2026-03-05")).toBe("5. 3. 2026")
  })

  it("builds a YYYY-MM month key from a date", () => {
    expect(getActivityMonthKey("2026-03-12")).toBe("2026-03")
  })

  it("labels a month key in Czech", () => {
    expect(getActivityMonthLabel("2026-03")).toBe("Březen 2026")
  })

  it("labels December correctly through the month-index mapping", () => {
    expect(getActivityMonthLabel("2026-12")).toBe("Prosinec 2026")
  })

  it("sorts month keys lexicographically ascending", () => {
    const earlier = getActivityMonthKey("2026-02-01")
    const later = getActivityMonthKey("2026-10-05")
    expect(earlier.localeCompare(later)).toBeLessThan(0)
  })
})
