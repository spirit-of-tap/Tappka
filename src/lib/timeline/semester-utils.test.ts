import { describe, expect, it } from "vitest"
import { getSemesterInfo } from "./semester-utils"

describe("getSemesterInfo", () => {
  it("returns null for empty or invalid dates", () => {
    expect(getSemesterInfo(null)).toBeNull()
    expect(getSemesterInfo("")).toBeNull()
    expect(getSemesterInfo("invalid-date")).toBeNull()
  })

  it("handles Winter semester dates with 4-digit onboardingYear", () => {
    // October 2025 (m = 10)
    const oct = getSemesterInfo("2025-10-15", 2025)
    expect(oct).toEqual({
      key: "2025-ZS",
      semester: "winter",
      semesterName: "Zimní semestr",
      academicStartYear: 2025,
      academicYearLabel: "2025/2026",
      studyYear: 1,
      label: "Zimní semestr — 1. ročník (2025/2026)",
    })

    // January 2026 (m = 1) -> Still winter semester of 2025/2026 academic year
    const jan = getSemesterInfo("2026-01-20", 2025)
    expect(jan).toEqual({
      key: "2025-ZS",
      semester: "winter",
      semesterName: "Zimní semestr",
      academicStartYear: 2025,
      academicYearLabel: "2025/2026",
      studyYear: 1,
      label: "Zimní semestr — 1. ročník (2025/2026)",
    })
  })

  it("handles relative onboardingYear (e.g. 1 for 1st year cohort)", () => {
    const mar = getSemesterInfo("2026-03-10", 1)
    expect(mar).toEqual({
      key: "2025-LS",
      semester: "summer",
      semesterName: "Letní semestr",
      academicStartYear: 2025,
      academicYearLabel: "2025/2026",
      studyYear: 1,
      label: "Letní semestr — 1. ročník (2025/2026)",
    })
  })

  it("handles Summer semester dates correctly", () => {
    // March 2026 (m = 3)
    const mar = getSemesterInfo("2026-03-10", 2025)
    expect(mar).toEqual({
      key: "2025-LS",
      semester: "summer",
      semesterName: "Letní semestr",
      academicStartYear: 2025,
      academicYearLabel: "2025/2026",
      studyYear: 1,
      label: "Letní semestr — 1. ročník (2025/2026)",
    })

    // May 2026 (m = 5)
    const may = getSemesterInfo("2026-05-01", 2025)
    expect(may?.key).toBe("2025-LS")
  })

  it("formats label without study year when onboardingYear is not provided", () => {
    const info = getSemesterInfo("2025-11-01")
    expect(info?.label).toBe("Zimní semestr (2025/2026)")
  })

  it("advances study year for 2nd and 3rd year", () => {
    const year2 = getSemesterInfo("2026-10-01", 2025)
    expect(year2?.studyYear).toBe(2)
    expect(year2?.label).toBe("Zimní semestr — 2. ročník (2026/2027)")

    const year3 = getSemesterInfo("2028-03-01", 2025)
    expect(year3?.studyYear).toBe(3)
    expect(year3?.label).toBe("Letní semestr — 3. ročník (2027/2028)")
  })
})
