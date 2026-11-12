import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TiptapRenderer } from "./tiptap-renderer"

const cell = (type: "tableHeader" | "tableCell", value: string) => ({
  type,
  content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
})

const tableDoc = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [
        { type: "tableRow", content: [cell("tableHeader", "Datum"), cell("tableHeader", "Téma")] },
        { type: "tableRow", content: [cell("tableCell", "1. 10."), cell("tableCell", "Úvod")] },
      ],
    },
  ],
}

describe("TiptapRenderer", () => {
  it("renders a table with a header and body cells", () => {
    const { container } = render(<TiptapRenderer content={tableDoc} />)

    const table = container.querySelector("table")
    expect(table).not.toBeNull()
    expect(table?.querySelectorAll("th")).toHaveLength(2)
    expect(table?.querySelectorAll("td")).toHaveLength(2)
    expect(table).toHaveTextContent("Datum")
    expect(table).toHaveTextContent("Úvod")
  })
})
