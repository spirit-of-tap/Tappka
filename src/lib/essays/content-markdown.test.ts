import { describe, expect, it } from "vitest"

import { contentJsonToMarkdown } from "./content-markdown"

const text = (value: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) => ({ type: "text", text: value, marks })
const p = (...content: object[]) => ({ type: "paragraph", content })
const doc = (...content: object[]) => ({ type: "doc", content })

describe("contentJsonToMarkdown", () => {
  it("returns an empty string for empty or invalid input", () => {
    expect(contentJsonToMarkdown(null)).toBe("")
    expect(contentJsonToMarkdown({})).toBe("")
    expect(contentJsonToMarkdown(doc({ type: "paragraph" }))).toBe("")
  })

  it("separates paragraphs and headings with blank lines", () => {
    const json = doc({ type: "heading", attrs: { level: 2 }, content: [text("Úkol")] }, p(text("Přečtěte si článek.")))
    expect(contentJsonToMarkdown(json)).toBe("## Úkol\n\nPřečtěte si článek.")
  })

  it("renders inline marks and links", () => {
    const json = doc(
      p(
        text("tučně", [{ type: "bold" }]),
        text(" a "),
        text("odkaz", [{ type: "link", attrs: { href: "https://example.com" } }]),
        text(" a "),
        text("kód", [{ type: "code" }]),
      ),
    )
    expect(contentJsonToMarkdown(json)).toBe("**tučně** a [odkaz](https://example.com) a `kód`")
  })

  it("drops marks Markdown cannot express", () => {
    expect(contentJsonToMarkdown(doc(p(text("důležité", [{ type: "underline" }, { type: "highlight" }]))))).toBe("důležité")
  })

  it("renders bullet, ordered and nested lists", () => {
    const item = (...content: object[]) => ({ type: "listItem", content })
    const json = doc(
      { type: "bulletList", content: [item(p(text("A")), { type: "orderedList", attrs: { start: 1 }, content: [item(p(text("B")))] }), item(p(text("C")))] },
      { type: "orderedList", attrs: { start: 3 }, content: [item(p(text("D"))), item(p(text("E")))] },
    )
    expect(contentJsonToMarkdown(json)).toBe("- A\n  1. B\n- C\n\n3. D\n4. E")
  })

  it("renders quotes, code blocks, rules and hard breaks", () => {
    const json = doc(
      { type: "blockquote", content: [p(text("Citace"))] },
      { type: "codeBlock", attrs: { language: "ts" }, content: [text("const a = 1")] },
      { type: "horizontalRule" },
      p(text("řádek"), { type: "hardBreak" }, text("další")),
    )
    expect(contentJsonToMarkdown(json)).toBe("> Citace\n\n```ts\nconst a = 1\n```\n\n---\n\nřádek  \ndalší")
  })
})
