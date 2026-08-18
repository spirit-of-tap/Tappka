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

  it("builds a YYYY-MM month key from a date", () => {
    expect(getActivityMonthKey("2026-03-12")).toBe("2026-03")
  })

  it("labels a month key in Czech", () => {
    expect(getActivityMonthLabel("2026-03")).toBe("Březen 2026")
  })

  it("sorts month keys lexicographically ascending", () => {
    expect("2026-02".localeCompare("2026-10")).toBeLessThan(0)
  })
})
