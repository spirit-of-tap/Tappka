import { describe, expect, it } from "vitest"
import {
  MEMBER_CHART_AXIS_HEIGHT,
  MEMBER_CHART_LEGEND_HEIGHT,
  MEMBER_CHART_MIN_HEIGHT,
  MEMBER_CHART_ROW_HEIGHT,
  memberChartHeight,
} from "@/lib/charts/member-chart-layout"

describe("memberChartHeight", () => {
  it("grows by one row height per member", () => {
    const ten = memberChartHeight(10)
    const eleven = memberChartHeight(11)
    expect(eleven - ten).toBe(MEMBER_CHART_ROW_HEIGHT)
  })

  it("reserves room for the value axis on top of the rows", () => {
    expect(memberChartHeight(10)).toBe(10 * MEMBER_CHART_ROW_HEIGHT + MEMBER_CHART_AXIS_HEIGHT)
  })

  it("adds the extra chrome a legend needs", () => {
    expect(memberChartHeight(10, MEMBER_CHART_LEGEND_HEIGHT)).toBe(
      memberChartHeight(10) + MEMBER_CHART_LEGEND_HEIGHT,
    )
  })

  it("falls back to the minimum height for small teams", () => {
    expect(memberChartHeight(1)).toBe(MEMBER_CHART_MIN_HEIGHT)
    expect(memberChartHeight(0)).toBe(MEMBER_CHART_MIN_HEIGHT)
  })
})
