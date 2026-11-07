import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"

import { PlaybookRenderer } from "@/components/playbook/playbook-renderer"

import type { PlaybookSection } from "@/lib/playbook/types"

const SECTIONS: PlaybookSection[] = [
  {
    slug: "uvod",
    title: "Úvod",
    blocks: [
      { kind: "paragraph", text: "První odstavec kapitoly." },
      { kind: "heading", level: 3, text: "Podkapitola" },
      { kind: "list", ordered: false, items: ["První položka", "Druhá položka"] },
      { kind: "list", ordered: true, items: ["Krok jedna", "Krok dva"] },
      {
        kind: "table",
        headers: ["Pojem", "Význam"],
        rows: [
          ["AAR", "After action review"],
          ["ATP", "Applying theory to practice"],
        ],
      },
      { kind: "note", text: "Toto je poznámka." },
    ],
  },
  {
    slug: "druha-sekce",
    title: "Druhá sekce",
    blocks: [{ kind: "heading", level: 2, text: "Velký nadpis" }],
  },
]

describe("PlaybookRenderer", () => {
  const renderSections = () => render(<PlaybookRenderer sections={SECTIONS} />)

  it("renders a section per chapter section with id set to the slug", () => {
    const { container } = renderSections()
    const sections = Array.from(container.querySelectorAll("section"))
    expect(sections.map((s) => s.id)).toEqual(["uvod", "druha-sekce"])
  })

  it("renders the section title as an h2", () => {
    renderSections()
    expect(screen.getByRole("heading", { level: 2, name: "Úvod" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "Druhá sekce" })).toBeInTheDocument()
  })

  it("renders heading blocks as h3, and h2 for level 2", () => {
    renderSections()
    expect(screen.getByRole("heading", { level: 3, name: "Podkapitola" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "Velký nadpis" })).toBeInTheDocument()
  })

  it("renders paragraph blocks as p with their text", () => {
    renderSections()
    const paragraph = screen.getByText("První odstavec kapitoly.")
    expect(paragraph.tagName).toBe("P")
  })

  it("renders unordered lists as ul and ordered lists as ol with one li per item", () => {
    renderSections()
    const unorderedItem = screen.getByText("První položka")
    expect(unorderedItem.closest("ul")).not.toBeNull()
    expect(within(unorderedItem.closest("ul") as HTMLElement).getAllByRole("listitem")).toHaveLength(2)

    const orderedItem = screen.getByText("Krok jedna")
    expect(orderedItem.closest("ol")).not.toBeNull()
    expect(within(orderedItem.closest("ol") as HTMLElement).getAllByRole("listitem")).toHaveLength(2)
  })

  it("renders table blocks with header cells and row cells", () => {
    renderSections()
    const table = screen.getByRole("table")
    const headers = within(table).getAllByRole("columnheader")
    expect(headers.map((h) => h.textContent)).toEqual(["Pojem", "Význam"])
    const cells = within(table).getAllByRole("cell")
    expect(cells.map((c) => c.textContent)).toEqual(["AAR", "After action review", "ATP", "Applying theory to practice"])
  })

  it("renders note blocks as a distinguishable callout with their text", () => {
    renderSections()
    const note = screen.getByRole("note")
    expect(note).toHaveTextContent("Toto je poznámka.")
  })
})
