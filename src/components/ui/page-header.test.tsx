import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { PageHeader } from "@/components/ui/page-header"

describe("PageHeader", () => {
  it("renders the title as an h1 and an optional description", () => {
    render(<PageHeader title="Zákaznické schůzky" description="Záznamník schůzek" />)
    expect(screen.getByRole("heading", { level: 1, name: "Zákaznické schůzky" })).toBeInTheDocument()
    expect(screen.getByText("Záznamník schůzek")).toBeInTheDocument()
  })

  it("renders the count next to the action instead of as a dominant stat", () => {
    render(<PageHeader title="Koučování" count={{ value: 7, label: "sezení" }} action={<button>Nové sezení</button>} />)
    expect(screen.getByText("7 sezení")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Nové sezení" })).toBeInTheDocument()
  })

  it("keeps the description out of the h1 accessible name", () => {
    render(<PageHeader title="Profil" description="Tvůj účet, přístupy a nastavení aplikace" />)
    expect(screen.getByRole("heading", { level: 1, name: "Profil" })).toBeInTheDocument()
  })

  describe("back", () => {
    it("renders a back link above the title with href and visible label", () => {
      render(<PageHeader title="Nová týmová reflexe" back={{ href: "/tymova-reflexe", label: "Zpět na přehled" }} />)
      const link = screen.getByRole("link", { name: /zpět na přehled/i })
      expect(link).toHaveAttribute("href", "/tymova-reflexe")
    })

    it("does not render a back link without the prop", () => {
      render(<PageHeader title="Schůzky" />)
      expect(screen.queryByRole("link")).not.toBeInTheDocument()
    })
  })
})
