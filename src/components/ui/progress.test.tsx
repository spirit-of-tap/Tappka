import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { Progress } from "./progress"

describe("Progress UI component", () => {
  it("renders with default bg-muted track class", () => {
    render(<Progress value={40} data-testid="progress-bar" />)

    const root = screen.getByTestId("progress-bar")
    expect(root).toBeInTheDocument()
    expect(root.className).toContain("bg-muted")
  })

  it("applies custom indicatorClassName to indicator element", () => {
    const { container } = render(
      <Progress value={100} indicatorClassName="bg-success" data-testid="progress-bar" />,
    )

    const indicator = container.querySelector("[data-slot='progress-indicator']")
    expect(indicator).toBeInTheDocument()
    expect(indicator?.className).toContain("bg-success")
  })

  it("reflects the current value via aria-valuenow", () => {
    render(<Progress value={75} aria-label="Postup" />)

    const progressBar = screen.getByRole("progressbar", { name: "Postup" })
    expect(progressBar).toHaveAttribute("aria-valuenow", "75")
  })
})
