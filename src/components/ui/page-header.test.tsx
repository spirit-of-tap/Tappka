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
})
