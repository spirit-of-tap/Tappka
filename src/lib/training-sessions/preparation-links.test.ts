import { describe, expect, it } from "vitest"

import { findPreparationLink, isLinkOnlyPreparation } from "./preparation-links"

function docWithParagraphs(...paragraphs: Array<Array<{ text: string; href?: string }>>) {
  return {
    type: "doc",
    content: paragraphs.map((segments) => ({
      type: "paragraph",
      content: segments.map((segment) =>
        segment.href
          ? { type: "text", text: segment.text, marks: [{ type: "link", attrs: { href: segment.href } }] }
          : { type: "text", text: segment.text },
      ),
    })),
  }
}

describe("isLinkOnlyPreparation", () => {
  it("returns false for an empty document", () => {
    expect(isLinkOnlyPreparation(null)).toBe(false)
    expect(isLinkOnlyPreparation({ type: "doc", content: [{ type: "paragraph" }] })).toBe(false)
    expect(isLinkOnlyPreparation({ type: "doc" })).toBe(false)
  })

  it("returns true for a bare Google Docs link", () => {
    const doc = docWithParagraphs([
      { text: "https://docs.google.com/document/d/1ogZoqTFVRuPUCs38oyaJcp8yT1Std-Rv0fC40YRJw1o/edit?usp=sharing" },
    ])
    expect(isLinkOnlyPreparation(doc)).toBe(true)
  })

  it("returns true for a linked display text with almost no other text", () => {
    const doc = docWithParagraphs([
      { text: "Příprava je zde", href: "https://docs.google.com/document/d/abc/edit" },
    ])
    expect(isLinkOnlyPreparation(doc)).toBe(true)
  })

  it("returns true for a link with a short caption", () => {
    const doc = docWithParagraphs([
      { text: "viz dokument: " },
      { text: "https://docs.google.com/document/d/abc/edit", href: "https://docs.google.com/document/d/abc/edit" },
    ])
    expect(isLinkOnlyPreparation(doc)).toBe(true)
  })

  it("returns false for real preparation text with a link as supplement", () => {
    const doc = docWithParagraphs(
      [{ text: "Cíl: rozebrat 3 knihy na pomoc při výběru k četbě. Přečtěte si prosím první dvě kapitoly a připravte si dvě otázky do diskuze. Sejdeme se v kruhu a každá skupina představí hlavní myšlenku." }],
      [{ text: "Podklady: " }, { text: "prezentace", href: "https://docs.google.com/presentation/d/abc/edit" }],
    )
    expect(isLinkOnlyPreparation(doc)).toBe(false)
  })

  it("returns false when there is no link at all", () => {
    const doc = docWithParagraphs([{ text: "ahoj" }])
    expect(isLinkOnlyPreparation(doc)).toBe(false)
  })
})

describe("findPreparationLink", () => {
  it("prefers a link mark's href over the display text", () => {
    const doc = docWithParagraphs([{ text: "Příprava je zde", href: "https://docs.google.com/document/d/abc/edit" }])
    expect(findPreparationLink(doc)).toBe("https://docs.google.com/document/d/abc/edit")
  })

  it("falls back to a bare URL typed as text", () => {
    const doc = docWithParagraphs([{ text: "viz https://example.com/prep a pak dál" }])
    expect(findPreparationLink(doc)).toBe("https://example.com/prep")
  })

  it("makes a www. address absolute", () => {
    const doc = docWithParagraphs([{ text: "www.example.com/prep" }])
    expect(findPreparationLink(doc)).toBe("https://www.example.com/prep")
  })

  it("ignores non-web hrefs", () => {
    const doc = docWithParagraphs([{ text: "klikni", href: "javascript:alert(1)" }])
    expect(findPreparationLink(doc)).toBeNull()
  })

  it("returns null without any link", () => {
    expect(findPreparationLink(docWithParagraphs([{ text: "ahoj" }]))).toBeNull()
    expect(findPreparationLink(null)).toBeNull()
  })

  it("stays pure across repeated calls", () => {
    const doc = docWithParagraphs([{ text: "https://example.com/prep" }])
    expect(isLinkOnlyPreparation(doc)).toBe(true)
    expect(isLinkOnlyPreparation(doc)).toBe(true)
    expect(findPreparationLink(doc)).toBe("https://example.com/prep")
  })
})
