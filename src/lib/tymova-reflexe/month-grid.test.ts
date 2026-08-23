import { describe, expect, it } from "vitest"
import {
  buildSchoolYears,
  rocnikForSchoolYear,
  normalizeOnboardingYear,
  isRocnikovaMonth,
} from "./month-grid"

describe("buildSchoolYears", () => {
  it("normalizes a 1-digit onboardingYear (e.g. 1) to the 4-digit start year", () => {
    const years = buildSchoolYears([], [], "2026-08-01", 2, 1)
    // 2026-08 is school year 2025/2026. OnboardingYear 1 means ročník 1 is 2025/2026.
    expect(years.map((y) => y.label)).toEqual(["2025/2026", "2026/2027", "2027/2028"])
    expect(years.map((y) => y.rocnik)).toEqual([1, 2, 3])
  })

  it("handles standard 4-digit onboardingYear (e.g. 2024)", () => {
    const years = buildSchoolYears([], [], "2026-08-01", 2, 2024)
    expect(years.map((y) => y.label)).toEqual(["2024/2025", "2025/2026", "2026/2027"])
    expect(years.map((y) => y.rocnik)).toEqual([1, 2, 3])
    expect(years.find((y) => y.label === "2025/2026")?.isCurrentYear).toBe(true)
  })

  it("marks May with isMay: true and includes both monthly and rocnikova statuses", () => {
    const years = buildSchoolYears([], [], "2026-05-01", 0, 2025)
    const may = years[0].months.find((m) => m.month === "2026-05-01")
    expect(may).toBeDefined()
    expect(may?.isMay).toBe(true)
    expect(may?.monthlyStatus).toBe("current-missing")
    expect(may?.rocnikovaStatus).toBe("current-missing")

    const january = years[0].months.find((m) => m.month === "2026-01-01")
    expect(january?.isMay).toBe(false)
    expect(january?.rocnikovaStatus).toBeUndefined()
  })

  it("marks a month done when a matching reflection exists in the right map", () => {
    const years = buildSchoolYears(
      [
        { id: "monthly-1", month: "2025-10-01" },
        { id: "monthly-may", month: "2026-05-01" },
      ],
      [{ id: "rocnikova-may", month: "2026-05-01" }],
      "2026-05-01",
      0,
      2025,
    )
    const byMonth = Object.fromEntries(years[0].months.map((m) => [m.month, m]))
    expect(byMonth["2025-10-01"]).toMatchObject({
      monthlyStatus: "done",
      monthlyReflectionId: "monthly-1",
    })
    expect(byMonth["2026-05-01"]).toMatchObject({
      monthlyStatus: "done",
      monthlyReflectionId: "monthly-may",
      rocnikovaStatus: "done",
      rocnikovaReflectionId: "rocnikova-may",
    })
    expect(years[0].completedCount).toBe(3)
  })
})

describe("normalizeOnboardingYear", () => {
  it("keeps 4-digit calendar year unchanged", () => {
    expect(normalizeOnboardingYear(2024, 2025)).toBe(2024)
    expect(normalizeOnboardingYear(2025, 2025)).toBe(2025)
  })

  it("converts relative ročník 1 to current start year", () => {
    expect(normalizeOnboardingYear(1, 2025)).toBe(2025)
  })

  it("converts relative ročník 2 to (current start year - 1)", () => {
    expect(normalizeOnboardingYear(2, 2025)).toBe(2024)
  })

  it("converts relative ročník 3 to (current start year - 2)", () => {
    expect(normalizeOnboardingYear(3, 2025)).toBe(2023)
  })

  it("falls back to current start year when null", () => {
    expect(normalizeOnboardingYear(null, 2025)).toBe(2025)
  })
})

describe("rocnikForSchoolYear", () => {
  it("returns 1 for start year equal to onboarding year", () => {
    expect(rocnikForSchoolYear(2025, 2025)).toBe(1)
  })

  it("returns 2 for second year", () => {
    expect(rocnikForSchoolYear(2024, 2025)).toBe(2)
  })

  it("returns 3 for third year", () => {
    expect(rocnikForSchoolYear(2023, 2025)).toBe(3)
  })

  it("returns null if outside 1..3", () => {
    expect(rocnikForSchoolYear(2025, 2024)).toBeNull()
    expect(rocnikForSchoolYear(2020, 2025)).toBeNull()
  })
})

describe("isRocnikovaMonth", () => {
  it("returns true only for May (month 05)", () => {
    expect(isRocnikovaMonth("2026-05-01")).toBe(true)
    expect(isRocnikovaMonth("2026-01-01")).toBe(false)
    expect(isRocnikovaMonth("2025-10-01")).toBe(false)
  })
})
