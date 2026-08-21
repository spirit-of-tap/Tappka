import { describe, expect, it } from "vitest"
import { METRICS } from "./config"

describe("METRICS registry", () => {
  it("has unique, slug-shaped ids", () => {
    const ids = Object.keys(METRICS)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  it("defines the zákaznické schůzky goal (10 per semester, 60 for study)", () => {
    const m = METRICS["customer-meetings"]
    expect(m.target).toBe(10)
    expect(m.period).toBe("semester")
    expect(m.totalForStudy).toBe(60)
  })

  it("every metric declares a positive target or per-study-year targets", () => {
    for (const m of Object.values(METRICS)) {
      const hasTarget =
        ("target" in m && typeof m.target === "number" && m.target > 0) ||
        ("targetPerStudyYear" in m &&
          m.targetPerStudyYear != null &&
          Object.keys(m.targetPerStudyYear).length > 0)
      expect(hasTarget).toBe(true)
    }
  })
})
