import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MonthSection } from "./month-section"

describe("MonthSection", () => {
  it("shows label and count, content visible by default-open", () => {
    render(
      <MonthSection label="Květen 2026" count={2} defaultOpen>
        <p>obsah</p>
      </MonthSection>,
    )
    expect(screen.getByText("Květen 2026")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("obsah")).toBeInTheDocument()
  })

  it("starts collapsed when defaultOpen is false and toggles via header", async () => {
    const user = userEvent.setup()
    render(
      <MonthSection label="Duben 2026" count={0}>
        <p>obsah</p>
      </MonthSection>,
    )
    const toggle = screen.getByRole("button", { name: /Duben 2026/ })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    const content = screen.getByText("obsah").closest("div")
    expect(content).toHaveAttribute("hidden")
    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("obsah")).toBeInTheDocument()
    expect(screen.getByText("obsah").closest("div")).not.toHaveAttribute("hidden")
  })

  it("forceOpen keeps content visible regardless of collapse", async () => {
    const user = userEvent.setup()
    render(
      <MonthSection label="Březen 2026" count={1} forceOpen>
        <p>obsah</p>
      </MonthSection>,
    )
    await user.click(screen.getByRole("button", { name: /Březen 2026/ }))
    expect(screen.getByText("obsah")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Březen 2026/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
  })
})
