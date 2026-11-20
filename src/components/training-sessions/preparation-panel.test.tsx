import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildDraftKey, writeDraft } from "@/lib/editor-drafts/draft-storage"
import { PreparationPanel } from "./preparation-panel"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/essays/tiptap-editor", () => ({
  TiptapEditor: ({ onChange }: { onChange?: (json: object) => void }) => (
    <div data-testid="tiptap-editor">
      <textarea
        aria-label="Editor přípravy"
        onChange={(e) =>
          onChange?.({
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: e.target.value }] }],
          })
        }
      />
    </div>
  ),
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

function renderPanel(contentJson: object | null) {
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

describe("PreparationPanel save shortcut", () => {
  it("saves rich text on Ctrl+S", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)
    renderPanel(RICH_DOC)

    fireEvent.keyDown(window, { key: "s", ctrlKey: true })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/training-sessions/session-1/preparation",
      expect.objectContaining({ method: "PUT" }),
    )
    expect(screen.queryByText("Vložit přípravu rovnou do Tappky?")).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it("saves rich text on Cmd+S", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)
    renderPanel(RICH_DOC)

    fireEvent.keyDown(window, { key: "s", metaKey: true })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    vi.unstubAllGlobals()
  })

  it("warns instead of saving on Ctrl+S when the preparation is only a link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)
    renderPanel(LINK_ONLY_DOC)

    fireEvent.keyDown(window, { key: "s", ctrlKey: true })

    expect(await screen.findByText("Vložit přípravu rovnou do Tappky?")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("ignores a repeat Ctrl+S while a save is in flight", async () => {
    let resolveSave!: (value: unknown) => void
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        }),
    )
    vi.stubGlobal("fetch", fetchMock)
    renderPanel(RICH_DOC)

    fireEvent.keyDown(window, { key: "s", ctrlKey: true })
    fireEvent.keyDown(window, { key: "s", ctrlKey: true })
    resolveSave({ ok: true, json: async () => ({}) })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    vi.unstubAllGlobals()
  })
})

describe("PreparationPanel draft recovery", () => {
  const scope = "preparation:session-1"

  beforeEach(() => {
    window.localStorage.clear()
  })

  it("offers to restore a draft and saves the restored content", async () => {
    writeDraft(window.localStorage, scope, { contentJson: RICH_DOC })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)
    renderPanel(null)

    expect(screen.getByText(/Máš rozepsaný text z/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Obnovit" }))
    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Uložit" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/training-sessions/session-1/preparation",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ contentJson: RICH_DOC }),
        }),
      )
    })

    // The saved content is on the server and the editor still holds exactly
    // that content, so the local draft is redundant.
    expect(window.localStorage.getItem(buildDraftKey(scope))).toBeNull()
  })

  it("keeps the draft when the person keeps typing during the save", async () => {
    writeDraft(window.localStorage, scope, { contentJson: RICH_DOC })
    let resolveFetch: (value: unknown) => void
    const fetchMock = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve }))
    vi.stubGlobal("fetch", fetchMock)
    renderPanel(null)

    fireEvent.click(screen.getByRole("button", { name: "Obnovit" }))

    fireEvent.click(screen.getByRole("button", { name: "Uložit" }))
    // While the PUT is in flight, the person keeps typing.
    fireEvent.change(screen.getByLabelText("Editor přípravy"), { target: { value: "ještě píšu" } })
    resolveFetch!({ ok: true, json: async () => ({}) })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    expect(window.localStorage.getItem(buildDraftKey(scope))).not.toBeNull()
  })

  it("Zahodit clears the draft and hides the banner", async () => {
    writeDraft(window.localStorage, scope, { contentJson: RICH_DOC })
    vi.stubGlobal("fetch", vi.fn())
    renderPanel(null)

    fireEvent.click(screen.getByRole("button", { name: "Zahodit" }))

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument()
    expect(window.localStorage.getItem(buildDraftKey(scope))).toBeNull()
  })

  it("stays silent when the published copy is newer than the draft", () => {
    // Both timestamps must stay inside the 14-day TTL, or the draft would be
    // dropped by expiry before the comparison ever runs.
    const now = Date.now()
    window.localStorage.setItem(buildDraftKey(scope), JSON.stringify({
      savedAt: new Date(now - 2 * 3_600_000).toISOString(),
      payload: { contentJson: RICH_DOC },
    }))
    render(
      <PreparationPanel
        sessionId="session-1"
        topic="Knihy 3v1"
        canEdit
        upcoming
        contentJson={RICH_DOC}
        publishedAt={new Date(now - 3_600_000).toISOString()}
        attachments={[]}
        startsAt="2026-11-16T07:00:00.000Z"
        endsAt="2026-11-16T11:00:00.000Z"
        facilitatorNames={[]}
      />,
    )

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument()
  })

  it("viewers never see the recovery banner", () => {
    writeDraft(window.localStorage, scope, { contentJson: RICH_DOC })
    render(
      <PreparationPanel
        sessionId="session-1"
        topic="Knihy 3v1"
        canEdit={false}
        upcoming
        contentJson={RICH_DOC}
        publishedAt="2026-11-16T07:00:00.000Z"
        attachments={[]}
        startsAt="2026-11-16T07:00:00.000Z"
        endsAt="2026-11-16T11:00:00.000Z"
        facilitatorNames={[]}
      />,
    )

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument()
  })
})
