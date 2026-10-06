import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CopyPreparationButton } from "./copy-preparation-button"

const contentJson = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Přečtěte si článek", marks: [{ type: "bold" }] }] }],
}

describe("CopyPreparationButton", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("copies the topic and preparation as Markdown and confirms it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    render(<CopyPreparationButton topic="AI v projektech" contentJson={contentJson} />)

    fireEvent.click(screen.getByRole("button", { name: "Kopírovat přípravu" }))

    expect(await screen.findByRole("button", { name: "Příprava zkopírována" })).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith("# AI v projektech\n\n**Přečtěte si článek**\n")
  })
})
