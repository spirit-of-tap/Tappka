import { describe, expect, it } from "vitest"
import { buildSchoolYears, rocnikForSchoolYear, isSemesterMonth } from "./month-grid"

describe("buildSchoolYears", () => {
  it("returns 3 school years (current + 2 back), oldest first, when onboardingYear is unknown", () => {
    const years = buildSchoolYears([], [], "2026-07-01")
    expect(years.map((y) => y.label)).toEqual(["2023/2024", "2024/2025", "2025/2026"])
  })

  it("marks months after the current month as future instead of omitting them", () => {
    const years = buildSchoolYears([], [], "2025-11-01", 0)
    const current = years[years.length - 1]
    expect(current.label).toBe("2025/2026")
    const byMonth = Object.fromEntries(current.months.map((m) => [m.month, m.status]))
    expect(byMonth["2025-09-01"]).toBe("missing")
    expect(byMonth["2025-11-01"]).toBe("current-missing")
    expect(byMonth["2025-12-01"]).toBe("future")
    expect(byMonth["2026-05-01"]).toBe("future")
  })

  it("treats a July/August current month as belonging to the school year that just ended", () => {
    const years = buildSchoolYears([], [], "2026-07-01", 0)
    expect(years[years.length - 1].label).toBe("2025/2026")
  })

  it("marks January and May as semester months, everything else as monthly", () => {
    const years = buildSchoolYears([], [], "2026-05-01", 0)
    const kinds = Object.fromEntries(years[0].months.map((m) => [m.month, m.kind]))
    expect(kinds["2026-01-01"]).toBe("semester")
    expect(kinds["2026-05-01"]).toBe("semester")
    expect(kinds["2025-09-01"]).toBe("monthly")
    expect(kinds["2026-02-01"]).toBe("monthly")
  })

  it("marks a month done when a matching reflection exists, in the right map by kind", () => {
    const years = buildSchoolYears(
      [{ id: "monthly-1", month: "2025-10-01" }],
      [{ id: "semester-1", month: "2026-01-01" }],
      "2026-01-01",
      0,
    )
    const byMonth = Object.fromEntries(years[0].months.map((m) => [m.month, m]))
    expect(byMonth["2025-10-01"]).toMatchObject({ status: "done", reflectionId: "monthly-1" })
    expect(byMonth["2026-01-01"]).toMatchObject({ status: "done", reflectionId: "semester-1" })
  })

  it("does not cross-match a monthly reflection into a semester slot or vice versa", () => {
    const years = buildSchoolYears(
      [{ id: "wrong-kind", month: "2026-01-01" }],
      [],
      "2026-01-01",
      0,
    )
    const january = years[0].months.find((m) => m.month === "2026-01-01")
    expect(january).toMatchObject({ status: "current-missing", reflectionId: null })
  })

  it("marks the current month as current-missing when absent, and past months as missing", () => {
    const years = buildSchoolYears([], [], "2025-11-01", 0)
    const byMonth = Object.fromEntries(years[0].months.map((m) => [m.month, m]))
    expect(byMonth["2025-11-01"].status).toBe("current-missing")
    expect(byMonth["2025-09-01"].status).toBe("missing")
  })

  it("computes rocnik for each school year from onboardingYear", () => {
    const years = buildSchoolYears([], [], "2026-07-01", 2, 2023)
    expect(years.map((y) => [y.label, y.rocnik])).toEqual([
      ["2023/2024", 1],
      ["2024/2025", 2],
      ["2025/2026", 3],
    ])
  })

  it("defaults rocnik to null when onboardingYear is not provided", () => {
    const years = buildSchoolYears([], [], "2026-07-01", 0)
    expect(years[0].rocnik).toBeNull()
  })

  it("shows the team's whole fixed 3-year program when onboardingYear is known, including years still ahead", () => {
    // Team just onboarded this school year — ročník 2 and 3 haven't started
    // yet, but should still appear as an upcoming roadmap, not be missing.
    const years = buildSchoolYears([], [], "2025-10-01", 2, 2025)
    expect(years.map((y) => [y.label, y.rocnik])).toEqual([
      ["2025/2026", 1],
      ["2026/2027", 2],
      ["2027/2028", 3],
    ])
    expect(years[1].months.every((m) => m.status === "future")).toBe(true)
    expect(years[2].months.every((m) => m.status === "future")).toBe(true)
  })

  it("omits school years before the team's onboarding year instead of showing them empty", () => {
    const years = buildSchoolYears([], [], "2026-07-01", 2, 2025)
    expect(years.map((y) => y.label)).toEqual(["2025/2026", "2026/2027", "2027/2028"])
  })
})

describe("rocnikForSchoolYear", () => {
  it("returns null when onboardingYear is unset", () => {
    expect(rocnikForSchoolYear(null, 2025)).toBeNull()
  })

  it("returns 1 for the team's first school year and increments each year after", () => {
    expect(rocnikForSchoolYear(2024, 2024)).toBe(1)
    expect(rocnikForSchoolYear(2024, 2025)).toBe(2)
    expect(rocnikForSchoolYear(2024, 2026)).toBe(3)
  })

  it("returns null for a school year before the team onboarded", () => {
    expect(rocnikForSchoolYear(2024, 2023)).toBeNull()
  })
})

describe("isSemesterMonth", () => {
  it("is true for January and May", () => {
    expect(isSemesterMonth("2026-01-01")).toBe(true)
    expect(isSemesterMonth("2026-05-01")).toBe(true)
  })

  it("is false for every other month", () => {
    expect(isSemesterMonth("2026-09-01")).toBe(false)
    expect(isSemesterMonth("2026-12-01")).toBe(false)
  })
})
