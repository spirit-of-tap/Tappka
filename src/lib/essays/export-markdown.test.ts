import { describe, expect, it } from "vitest"

import { formatEssayForClipboard, formatEssaysForClipboard, type ExportableEssay } from "./export-markdown"

const text = (value: string) => ({ type: "text", text: value })
const doc = (value: string) => ({ type: "doc", content: [{ type: "paragraph", content: [text(value)] }] })

const book: ExportableEssay["book"] = {
  id: "b1",
  title_cs: "Sprint",
  author: "Jake Knapp",
  book_points: 3,
  list_status: "shortlist",
  is_rocket_model: false,
  google_books_cover_url: null,
  highlight_category: null,
}

const essay = (overrides: Partial<ExportableEssay> = {}): ExportableEssay => ({
  title: "Vedení týmu",
  content_json: doc("Text eseje."),
  created_at: "2026-09-01T12:00:00Z",
  book: null,
  content_source: null,
  frozen_book_points: null,
  ...overrides,
})

describe("formatEssayForClipboard", () => {
  it("writes a single essay as a top-level heading with source, date and body", () => {
    expect(formatEssayForClipboard(essay({ book }))).toBe(
      "# Vedení týmu\n\n**Zdroj:** Sprint — Jake Knapp · **Datum:** 1. 9. 2026\n\nText eseje.\n",
    )
  })

  it("omits the source when the essay has none", () => {
    expect(formatEssayForClipboard(essay())).toBe(
      "# Vedení týmu\n\n**Datum:** 1. 9. 2026\n\nText eseje.\n",
    )
  })

  it("skips an empty body instead of leaving a trailing blank block", () => {
    expect(formatEssayForClipboard(essay({ content_json: {}, book }))).toBe(
      "# Vedení týmu\n\n**Zdroj:** Sprint — Jake Knapp · **Datum:** 1. 9. 2026\n",
    )
  })
})

describe("formatEssaysForClipboard", () => {
  it("nests each essay under a second-level heading and separates them with a rule", () => {
    expect(
      formatEssaysForClipboard([
        essay({ title: "První", content_json: doc("Jedna.") }),
        essay({ title: "Druhá", content_json: doc("Dva.") }),
      ]),
    ).toBe(
      "## První\n\n**Datum:** 1. 9. 2026\n\nJedna.\n\n---\n\n## Druhá\n\n**Datum:** 1. 9. 2026\n\nDva.\n",
    )
  })

  it("returns just a newline for an empty list", () => {
    expect(formatEssaysForClipboard([])).toBe("\n")
  })
})
