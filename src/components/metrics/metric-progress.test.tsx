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

  it("renders mobile single semester chunk and desktop 6-segment bar", () => {
    const { container } = render(
      <MetricProgress
        currentSemester={3}
        goals={[
          { current: 2, target: 20, label: "tento semestr" },
          { current: 42, target: 120, label: "za studium" },
        ]}
      />,
    )

    // Mobile view (< sm): single bar showing current semester chunk (2/20 = 10%)
    const mobileBar = container.querySelector('.sm\\:hidden [data-slot="metric-bar"]')
    expect(mobileBar).toHaveStyle({ width: "10%" })
    expect(screen.getByText("2/20")).toBeInTheDocument()
    expect(screen.getByText("(zbývá 18)")).toBeInTheDocument()

    // Desktop view (>= sm): 6 semester segment bars
    const desktopBars = container.querySelectorAll('.hidden.sm\\:block [data-slot="metric-bar"]')
    expect(desktopBars).toHaveLength(6)

    // Sem 1 (0..20): 100% full
    expect(desktopBars[0]).toHaveStyle({ width: "100%" })
    // Sem 2 (20..40): 100% full
    expect(desktopBars[1]).toHaveStyle({ width: "100%" })
    // Sem 3 (40..60): 42 - 40 = 2 / 20 = 10%
    expect(desktopBars[2]).toHaveStyle({ width: "10%" })
    // Sem 4..6: 0%
    expect(desktopBars[3]).toHaveStyle({ width: "0%" })
    expect(desktopBars[4]).toHaveStyle({ width: "0%" })
    expect(desktopBars[5]).toHaveStyle({ width: "0%" })

    // Milestones 20, 40, 60, 80, 100, 120 rendered
    expect(screen.getByText("20")).toBeInTheDocument()
    expect(screen.getByText("40")).toBeInTheDocument()
    expect(screen.getByText("60")).toBeInTheDocument()
    expect(screen.getByText("80")).toBeInTheDocument()
    expect(screen.getByText("100")).toBeInTheDocument()
    expect(screen.getByText("120")).toBeInTheDocument()
  })

  it("correctly credits carry-over points into current semester even when current semester goal is 0", () => {
    const { container } = render(
      <MetricProgress
        currentSemester={3}
        goals={[
          { current: 0, target: 20, label: "tento semestr" },
          { current: 42, target: 120, label: "za studium" },
        ]}
      />,
    )

    // Mobile view should credit the 2 carry-over points from previous semesters (42 - 40 = 2)
    const mobileBar = container.querySelector('.sm\\:hidden [data-slot="metric-bar"]')
    expect(mobileBar).toHaveStyle({ width: "10%" })
    expect(screen.getByText("2/20")).toBeInTheDocument()
    expect(screen.getByText("(zbývá 18)")).toBeInTheDocument()
  })
})
