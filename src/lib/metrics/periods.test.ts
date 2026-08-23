import { describe, expect, it } from "vitest"
import { getCurrentSemesterRange } from "./periods"

describe("getCurrentSemesterRange", () => {
  it("January belongs to the winter semester that started last September", () => {
    const { start, end } = getCurrentSemesterRange(new Date(2026, 0, 20))
    expect(start.getFullYear()).toBe(2025)
    expect(start.getMonth()).toBe(8) // September
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(1) // February
  })

  it("February–August is the summer semester", () => {
    const { start, end } = getCurrentSemesterRange(new Date(2026, 4, 15))
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(1)
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(8)
  })

  it("September starts a winter semester ending next February", () => {
    const { start, end } = getCurrentSemesterRange(new Date(2026, 8, 1))
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(8)
    expect(end.getFullYear()).toBe(2027)
    expect(end.getMonth()).toBe(1)
  })
})
