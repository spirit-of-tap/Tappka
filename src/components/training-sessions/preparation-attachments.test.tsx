import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TS_ATTACHMENT_MESSAGES } from "@/lib/training-sessions/attachments"
import type { TsAttachmentSummary } from "@/lib/training-sessions/types"

import { PreparationAttachments } from "./preparation-attachments"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const BOOK: TsAttachmentSummary = {
  id: "a1",
  label: "Kniha k přečtení",
  file_name: "atomove-navyky.pdf",
  file_size: 2 * 1024 * 1024,
  content_type: "application/pdf",
}

function pickFile(name: string, type = "application/pdf") {
  const input = screen.getByLabelText("Soubor")
  fireEvent.change(input, { target: { files: [new File(["x"], name, { type })] } })
}

describe("PreparationAttachments", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("renders nothing for viewers when there are no attachments", () => {
    const { container } = render(<PreparationAttachments sessionId="s1" attachments={[]} canEdit={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("lists attachments with their label, file name and a download link for viewers", () => {
    render(<PreparationAttachments sessionId="s1" attachments={[BOOK]} canEdit={false} />)
    expect(screen.getByText("Kniha k přečtení")).toBeInTheDocument()
    expect(screen.getByText(/atomove-navyky\.pdf · 2,0 MB/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Stáhnout Kniha k přečtení" })).toHaveAttribute(
      "href",
      "/api/training-sessions/s1/attachments/a1",
    )
    expect(screen.queryByRole("button", { name: /Přidat přílohu/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Odebrat/ })).not.toBeInTheDocument()
  })

  it("tells facilitators that attachments are supporting materials only", () => {
    render(<PreparationAttachments sessionId="s1" attachments={[]} canEdit />)
    expect(screen.getByRole("button", { name: /Přidat přílohu/ })).toHaveTextContent(/Jen podklady/)
  })

  it("blocks a file named as the preparation without calling the API", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    render(<PreparationAttachments sessionId="s1" attachments={[]} canEdit />)
    fireEvent.click(screen.getByRole("button", { name: /Přidat přílohu/ }))

    fireEvent.change(screen.getByLabelText("Co příloha obsahuje"), { target: { value: "Podklady" } })
    pickFile("Příprava_TS_12.pdf")
    fireEvent.click(screen.getByRole("button", { name: "Přidat" }))

    expect(screen.getByRole("alert")).toHaveTextContent(TS_ATTACHMENT_MESSAGES.looksLikePreparation)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("requires a label before uploading", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    render(<PreparationAttachments sessionId="s1" attachments={[]} canEdit />)
    fireEvent.click(screen.getByRole("button", { name: /Přidat přílohu/ }))

    pickFile("atomove-navyky.pdf")
    fireEvent.click(screen.getByRole("button", { name: "Přidat" }))

    expect(screen.getByRole("alert")).toHaveTextContent(TS_ATTACHMENT_MESSAGES.labelRequired)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
