import { describe, expect, it } from "vitest"

import { parseMarkdownTable } from "./markdown-table"

const p = (...content: object[]) => (content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" })
const cell = (text: string, kind: "tableHeader" | "tableCell" = "tableCell", align: string | null = null) => ({
  type: kind,
  attrs: { colspan: 1, rowspan: 1, colwidth: null, align },
  content: [p(...(text === "" ? [] : [{ type: "text", text }]))],
})
const row = (...cells: object[]) => ({ type: "tableRow", content: cells })

describe("parseMarkdownTable", () => {
  it("parses a header row and body rows into table nodes", () => {
    const markdown = ["| Datum | Téma |", "| --- | --- |", "| 1. 10. | Úvod |"].join("\n")

    expect(parseMarkdownTable(markdown)).toEqual({
      type: "table",
      content: [
        row(cell("Datum", "tableHeader"), cell("Téma", "tableHeader")),
        row(cell("1. 10."), cell("Úvod")),
      ],
    })
  })

  it("accepts tables without outer pipes and trims cell padding", () => {
    const markdown = ["Datum |  Téma  ", "--- | ---", "1. 10. | Úvod"].join("\n")

    expect(parseMarkdownTable(markdown)).toEqual({
      type: "table",
      content: [
        row(cell("Datum", "tableHeader"), cell("Téma", "tableHeader")),
        row(cell("1. 10."), cell("Úvod")),
      ],
    })
  })

  it("carries column alignment from the separator row", () => {
    const markdown = ["| Vlevo | Střed | Vpravo |", "| :--- | :---: | ---: |", "| a | b | c |"].join("\n")

    expect(parseMarkdownTable(markdown)).toEqual({
      type: "table",
      content: [
        row(cell("Vlevo", "tableHeader", "left"), cell("Střed", "tableHeader", "center"), cell("Vpravo", "tableHeader", "right")),
        row(cell("a", "tableCell", "left"), cell("b", "tableCell", "center"), cell("c", "tableCell", "right")),
      ],
    })
  })

  it("keeps escaped pipes as literal text", () => {
    const markdown = ["| Sloupec |", "| --- |", "| a \\| b |"].join("\n")

    expect(parseMarkdownTable(markdown)).toEqual({
      type: "table",
      content: [row(cell("Sloupec", "tableHeader")), row(cell("a | b"))],
    })
  })

  it("pads short body rows and ignores cells beyond the header width", () => {
    const markdown = ["| A | B |", "| --- | --- |", "| 1 |", "| 1 | 2 | 3 |"].join("\n")

    expect(parseMarkdownTable(markdown)).toEqual({
      type: "table",
      content: [
        row(cell("A", "tableHeader"), cell("B", "tableHeader")),
        row(cell("1"), cell("")),
        row(cell("1"), cell("2")),
      ],
    })
  })

  it("keeps a header-only table", () => {
    const markdown = ["| A | B |", "| --- | --- |"].join("\n")

    expect(parseMarkdownTable(markdown)).toEqual({
      type: "table",
      content: [row(cell("A", "tableHeader"), cell("B", "tableHeader"))],
    })
  })

  it("ignores blank lines around the table", () => {
    const markdown = "\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n"

    expect(parseMarkdownTable(markdown)).toEqual({
      type: "table",
      content: [
        row(cell("A", "tableHeader"), cell("B", "tableHeader")),
        row(cell("1"), cell("2")),
      ],
    })
  })

  it("returns null for text that is not a single markdown table", () => {
    expect(parseMarkdownTable("")).toBeNull()
    expect(parseMarkdownTable("Jen odstavec s | svislítkem.")).toBeNull()
    expect(parseMarkdownTable("| A | B |\n| --- | --- |\n\nText po tabulce")).toBeNull()
    expect(parseMarkdownTable("| A | B |\n| --- |\n| 1 | 2 |")).toBeNull()
    expect(parseMarkdownTable("| A | B |\n| bez oddělovače |\n| 1 | 2 |")).toBeNull()
    expect(parseMarkdownTable("| A | B |\n| --- | --- |\nText bez pipe")).toBeNull()
  })
})
