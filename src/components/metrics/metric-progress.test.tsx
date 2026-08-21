import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MetricProgress } from "./metric-progress"

describe("MetricProgress", () => {
  it("renders one row per goal with current/target and period label", () => {
    render(
      <MetricProgress
        goals={[
          { current: 6, target: 10, label: "tento semestr" },
          { current: 23, target: 60, label: "za studium" },
        ]}
      />,
    )
    expect(screen.getByText("6/10")).toBeInTheDocument()
    expect(screen.getByText("tento semestr")).toBeInTheDocument()
    expect(screen.getByText("23/60")).toBeInTheDocument()
    expect(screen.getByText("za studium")).toBeInTheDocument()
  })

  it("clamps values above target to a full bar", () => {
    const { container } = render(
      <MetricProgress goals={[{ current: 12, target: 10, label: "tento semestr" }]} />,
    )
    const bar = container.querySelector('[data-slot="metric-bar"]')
    expect(bar).toHaveStyle({ width: "100%" })
  })
})
