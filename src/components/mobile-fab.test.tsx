import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { MobileFab, MobileFabSpacer } from "./mobile-fab"

describe("MobileFab", () => {
  it("renders a labelled round action button", () => {
    render(<MobileFab label="Nové sezení" />)

    const fab = screen.getByRole("button", { name: "Nové sezení" })
    expect(fab).toHaveClass("rounded-full", "fixed", "sm:hidden")
  })

  it("renders a link variant when href is given", () => {
    render(<MobileFab label="Napsat esej" href="/cteni/eseje/nova" />)

    expect(screen.getByRole("link", { name: "Napsat esej" })).toHaveAttribute(
      "href",
      "/cteni/eseje/nova",
    )
  })

  it("spacer reserves mobile-only room above the bottom nav", () => {
    const { container } = render(<MobileFabSpacer />)

    const spacer = container.firstElementChild
    expect(spacer).toHaveClass("h-20", "sm:hidden")
    expect(spacer).toHaveAttribute("aria-hidden", "true")
  })
})
