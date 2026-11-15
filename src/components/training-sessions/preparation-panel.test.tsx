import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { PreparationPanel } from "./preparation-panel"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/essays/tiptap-editor", () => ({
  TiptapEditor: () => <div data-testid="tiptap-editor" />,
}))

const LINK_ONLY_DOC = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "https://docs.google.com/document/d/1ogZoqTFVRuPUCs38oyaJcp8yT1Std-Rv0fC40YRJw1o/edit?usp=sharing",
          marks: [{ type: "link", attrs: { href: "https://docs.google.com/document/d/abc/edit" } }],
        },
      ],
    },
  ],
}

const RICH_DOC = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Cíl: rozebrat 3 knihy na pomoc při výběru k četbě. Přečtěte si prosím první dvě kapitoly a připravte si dvě otázky do diskuze. Sejdeme se v kruhu a každá skupina představí hlavní myšlenku.",
        },
      ],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Podklady v prezentaci." }],
    },
  ],
}

function renderPanel(contentJson: object) {
  return render(
    <PreparationPanel
      sessionId="session-1"
      topic="Knihy 3v1"
      canEdit
      upcoming
      contentJson={contentJson}
      publishedAt={null}
      attachments={[]}
      startsAt="2026-11-16T07:00:00.000Z"
      endsAt="2026-11-16T11:00:00.000Z"
      facilitatorNames={[]}
    />,
  )
}

describe("PreparationPanel link-only warning", () => {
  it("nudges inline and warns instead of saving when the preparation is only a link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)
    renderPanel(LINK_ONLY_DOC)

    const note = screen.getByRole("note")
    expect(note).toHaveTextContent("Zatím je tu jen odkaz")
    expect(within(note).getByRole("link", { name: /Otevři dokument/ })).toHaveAttribute(
      "href",
      "https://docs.google.com/document/d/abc/edit",
    )

    fireEvent.click(screen.getByRole("button", { name: "Uložit" }))

    expect(await screen.findByText("Vložit přípravu rovnou do Tappky?")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("saves after confirming a link-only preparation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)
    renderPanel(LINK_ONLY_DOC)

    fireEvent.click(screen.getByRole("button", { name: "Uložit" }))
    fireEvent.click(await screen.findByRole("button", { name: "Uložit jen odkaz" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/training-sessions/session-1/preparation",
      expect.objectContaining({ method: "PUT" }),
    )
    vi.unstubAllGlobals()
  })

  it("keeps editing when the desired action is chosen", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)
    renderPanel(LINK_ONLY_DOC)

    fireEvent.click(screen.getByRole("button", { name: "Uložit" }))
    fireEvent.click(await screen.findByRole("button", { name: "Doplním text sem" }))

    await waitFor(() =>
      expect(screen.queryByText("Vložit přípravu rovnou do Tappky?")).not.toBeInTheDocument(),
    )
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("saves rich preparation text without a warning", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)
    renderPanel(RICH_DOC)

    expect(screen.queryByRole("note")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Uložit" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText("Vložit přípravu rovnou do Tappky?")).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
