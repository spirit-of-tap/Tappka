import { describe, expect, it } from "vitest"
import { METRICS, METRIC_PERIOD_LABELS, formatMetricValue } from "./config"

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

  it("defines the individuální koučování expectation (1 per semester, 6 for study)", () => {
    const m = METRICS["individual-coaching"]
    expect(m.target).toBe(1)
    expect(m.period).toBe("semester")
    expect(m.totalForStudy).toBe(6)
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

  it("defines the Čas týdně goal (40 hours per week)", () => {
    const m = METRICS["time-weekly"]
    expect(m.label).toBe("Čas týdně")
    expect(m.period).toBe("week")
    expect(m.target).toBe(40)
    expect(m.unit).toBe("hours")
  })

  it("has a Czech label for every period", () => {
    expect(METRIC_PERIOD_LABELS.week).toBe("tento týden")
    for (const m of Object.values(METRICS)) {
      expect(METRIC_PERIOD_LABELS[m.period]).toBeTruthy()
    }
  })
})

describe("formatMetricValue", () => {
  const NBSP = String.fromCharCode(0xa0)

  it("formats hours with a Czech decimal comma and one decimal at most", () => {
    expect(formatMetricValue(12.5, "hours")).toBe(`12,5${NBSP}h`)
    expect(formatMetricValue(40, "hours")).toBe(`40${NBSP}h`)
    expect(formatMetricValue(7.25, "hours")).toBe(`7,3${NBSP}h`)
  })

  it("formats percent and plain counts", () => {
    expect(formatMetricValue(80, "percent")).toBe(`80${NBSP}%`)
    expect(formatMetricValue(6)).toBe("6")
  })
})
