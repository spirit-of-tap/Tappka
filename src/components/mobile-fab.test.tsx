import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { MobileFab, MobileFabSpacer } from "./mobile-fab"

describe("MobileFab", () => {
  it("renders a labelled pill action button", () => {
    render(<MobileFab label="Nové sezení" />)

    const fab = screen.getByRole("button", { name: "Nové sezení" })
    expect(fab).toHaveClass("rounded-full", "fixed", "sm:hidden")
    // Visible label, not icon-only — the accessible name comes from the text.
    expect(fab).toHaveTextContent("Nové sezení")
  })

  it("renders a link variant when href is given", () => {
    render(<MobileFab label="Napsat esej" href="/cteni/eseje/nova" />)

    const fab = screen.getByRole("link", { name: "Napsat esej" })
    expect(fab).toHaveAttribute("href", "/cteni/eseje/nova")
    expect(fab).toHaveTextContent("Napsat esej")
  })

  it("spacer reserves mobile-only room above the bottom nav", () => {
    const { container } = render(<MobileFabSpacer />)

    const spacer = container.firstElementChild
    expect(spacer).toHaveClass("h-20", "sm:hidden")
    expect(spacer).toHaveAttribute("aria-hidden", "true")
  })
})
