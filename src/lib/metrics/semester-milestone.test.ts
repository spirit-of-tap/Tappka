import { describe, expect, it } from "vitest"

import { cumulativeSemesterMilestone, currentStudySemester } from "./semester-milestone"

describe("cumulativeSemesterMilestone", () => {
  it("multiplies the per-semester target by the semester", () => {
    expect(cumulativeSemesterMilestone(20, 120, 3)).toBe(60)
  })

  it("never exceeds the whole-study total", () => {
    expect(cumulativeSemesterMilestone(30, 120, 6)).toBe(120)
  })
})

describe("currentStudySemester", () => {
  it("stays within 1..6", () => {
    const semester = currentStudySemester(new Date("2040-01-01"), 2025)
    expect(semester).toBeGreaterThanOrEqual(1)
    expect(semester).toBeLessThanOrEqual(6)
  })
})
