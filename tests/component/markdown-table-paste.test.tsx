import { Editor } from "@tiptap/core"
import { describe, expect, it } from "vitest"

import { parseMarkdownTable } from "@/lib/essays/markdown-table"
import { createTiptapExtensions } from "@/lib/essays/tiptap-extensions"

describe("table paste into a real editor", () => {
  it("inserts the parsed table at the cursor", () => {
    const element = document.createElement("div")
    const editor = new Editor({ element, extensions: createTiptapExtensions() })

    const table = parseMarkdownTable("| A | B |\n| --- | --- |\n| 1 | 2 |")
    expect(table).not.toBeNull()
    editor.view.dispatch(editor.state.tr.replaceSelectionWith(editor.state.schema.nodeFromJSON(table!)))

    const inserted = editor.getJSON().content?.[0]
    expect(inserted?.type).toBe("table")
    expect(editor.getText()).toContain("A")
    editor.destroy()
  })
})
