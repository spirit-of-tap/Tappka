import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { MobileFab, MobileFabSpacer } from "./mobile-fab"

describe("MobileFab", () => {
  it("renders a labelled pill action button", () => {
    render(<MobileFab label="Nové sezení" />)

    const fab = screen.getByRole("button", { name: "Nové sezení" })
    expect(fab).toHaveClass("rounded-full", "fixed", "sm:hidden")
    // Visible label, not icon-only — the accessible name comes from the text.
    expect(fab).toHaveTextContent("Nové sezení")
  })

  it("forwards handlers to the DOM button (Radix asChild compatibility)", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<MobileFab label="Nová schůzka" onClick={onClick} />)

    // DialogTrigger asChild clones its child with onClick — the component must
    // spread it through, or clicks die silently.
    await user.click(screen.getByRole("button", { name: "Nová schůzka" }))
    expect(onClick).toHaveBeenCalledTimes(1)
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
