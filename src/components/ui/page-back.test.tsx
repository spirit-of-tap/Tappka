import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { PageBack } from "@/components/ui/page-back"

describe("PageBack", () => {
  it("renders a link with chevron and visible label", () => {
    render(<PageBack href="/schuzky" label="Zpět na přehled" />)
    const link = screen.getByRole("link", { name: /zpět na přehled/i })
    expect(link).toHaveAttribute("href", "/schuzky")
    // chevron is decorative, hidden from screen readers
    expect(link.querySelector("svg[aria-hidden='true']")).toBeInTheDocument()
  })

  it("keeps a native-app-sized tap target", () => {
    render(<PageBack href="/cteni" label="Zpět" />)
    const link = screen.getByRole("link", { name: /zpět/i })
    expect(link.className).toContain("min-h-11")
  })

  it("merges custom classes (for hero overlays) without losing the base ones", () => {
    render(<PageBack href="/komunita" label="Zpět" className="absolute top-4 left-4 rounded-full bg-background/70" />)
    const link = screen.getByRole("link", { name: /zpět/i })
    expect(link.className).toContain("min-h-11")
    expect(link.className).toContain("rounded-full")
  })
})
