import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { RocketSectionRadarPoint } from "@/lib/rocket-model/progress"
import { RocketRadarChart } from "./rocket-radar-chart"

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts")
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children:
        | React.ReactNode
        | ((props: { width: number; height: number }) => React.ReactNode)
    }) => {
      const content =
        typeof children === "function"
          ? children({ width: 500, height: 500 })
          : children
      return (
        <div style={{ width: 500, height: 500 }}>
          {React.isValidElement(content)
            ? React.cloneElement(
                content as React.ReactElement<{
                  width?: number
                  height?: number
                }>,
                { width: 500, height: 500 },
              )
            : content}
        </div>
      )
    },
  }
})

function sampleData(): RocketSectionRadarPoint[] {
  return [
    {
      categoryId: "cat-1",
      code: "Y1",
      title: "Y1 - Individual Learning",
      orderIndex: 0,
      totalItems: 4,
      teamCheckedCount: 2,
      teamCheckedPercent: 50,
      unanimousCount: 3,
      unanimousPercent: 75,
      memberAveragePercent: 60,
      totalMemberChecks: 12,
    },
    {
      categoryId: "cat-2",
      code: "J1",
      title: "J1 - Leading Thoughts",
      orderIndex: 1,
      totalItems: 2,
      teamCheckedCount: 0,
      teamCheckedPercent: 0,
      unanimousCount: 0,
      unanimousPercent: 0,
      memberAveragePercent: 25,
      totalMemberChecks: 2,
    },
  ]
}

describe("RocketRadarChart", () => {
  it("renders empty state when data is empty", () => {
    render(<RocketRadarChart data={[]} />)
    expect(screen.getByText("Žádná data pro zobrazení grafu")).toBeVisible()
  })

  it("renders chart with category codes for axes", () => {
    render(<RocketRadarChart data={sampleData()} />)
    expect(screen.getByText("Y1")).toBeInTheDocument()
    expect(screen.getByText("J1")).toBeInTheDocument()
  })

  it("renders with team_only mode without error", () => {
    const { container } = render(
      <RocketRadarChart data={sampleData()} metricMode="team_only" />,
    )
    expect(container.querySelector(".lucide")).toBeNull()
    expect(screen.getByText("Y1")).toBeInTheDocument()
  })

  it("renders with average_only mode without error", () => {
    render(<RocketRadarChart data={sampleData()} metricMode="average_only" />)
    expect(screen.getByText("Y1")).toBeInTheDocument()
  })

  it("renders with all metrics mode without error", () => {
    render(<RocketRadarChart data={sampleData()} metricMode="all" />)
    expect(screen.getByText("Y1")).toBeInTheDocument()
  })
})
