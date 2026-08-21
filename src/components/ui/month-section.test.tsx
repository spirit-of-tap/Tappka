import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MonthSection } from "./month-section"

describe("MonthSection", () => {
  it("renders label, count and always-visible content (no collapsing)", () => {
    render(
      <MonthSection label="Duben 2026" count={2}>
        <p>obsah</p>
      </MonthSection>,
    )
    expect(screen.getByText("Duben 2026")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("obsah")).toBeInTheDocument()
  })

  it("is not interactive — plain heading, no toggle control", () => {
    render(
      <MonthSection label="Květen 2026" count={0}>
        <p>obsah</p>
      </MonthSection>,
    )
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    const heading = screen.getByText("Květen 2026")
    expect(heading.tagName).toBe("H2")
  })
})
