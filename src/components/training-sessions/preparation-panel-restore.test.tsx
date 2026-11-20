import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { writeDraft } from "@/lib/editor-drafts/draft-storage"
import { PreparationPanel } from "./preparation-panel"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const PUBLISHED_DOC = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "publikovaný text" }] }],
}
const DRAFT_DOC = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "obnovený text" }] }],
}

describe("PreparationPanel restore with the real editor", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("shows the restored draft in the editor after Obnovit", async () => {
    writeDraft(window.localStorage, "preparation:session-1", { contentJson: DRAFT_DOC })
    const user = userEvent.setup()
    render(
      <PreparationPanel
        sessionId="session-1"
        topic="Knihy 3v1"
        canEdit
        upcoming
        contentJson={PUBLISHED_DOC}
        publishedAt="2026-11-16T07:00:00.000Z"
        attachments={[]}
        startsAt="2026-11-16T07:00:00.000Z"
        endsAt="2026-11-16T11:00:00.000Z"
        facilitatorNames={[]}
      />,
    )

    expect(screen.getByText("publikovaný text")).toBeInTheDocument()
    expect(screen.getByText(/Máš rozepsaný text z/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Obnovit" }))

    // The visible editor must now show the restored content, not the published one.
    expect(await screen.findByText("obnovený text")).toBeInTheDocument()
    expect(screen.queryByText("publikovaný text")).not.toBeInTheDocument()
  })
})
