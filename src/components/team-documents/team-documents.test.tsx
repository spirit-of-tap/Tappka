import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TeamDocuments } from "./team-documents"
import type { TeamDocumentWithVersions } from "@/lib/team-documents/types"

const { errorToast, successToast } = vi.hoisted(() => ({
  errorToast: vi.fn(),
  successToast: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: errorToast, success: successToast },
}))

const fetchMock = vi.fn()

function documentRow(
  overrides: Partial<TeamDocumentWithVersions> = {},
): TeamDocumentWithVersions {
  return {
    id: "document-1",
    team_id: "team-1",
    doc_type: "other",
    title: "Pravidla porad",
    removed_at: null,
    created_at: "2026-08-19T09:00:00Z",
    updated_at: "2026-08-19T09:00:00Z",
    created_by_profile_id: "profile-1",
    updated_by_profile_id: "profile-1",
    versions: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
  errorToast.mockReset()
  successToast.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("TeamDocuments", () => {
  it("always renders the two featured document slots", () => {
    const { container } = render(<TeamDocuments initialDocuments={[]} teamId="team-1" />)

    expect(screen.getByRole("heading", { name: "Týmová smlouva" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Finanční směrnice" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Nahrát první verzi" })).toHaveLength(2)
    expect(screen.queryByRole("button", { name: "Přejmenovat" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Archivovat" })).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(2)
    const customEmptyState = screen.getByText("Zatím žádné další dokumenty").closest(
      '[data-slot="empty"]',
    )
    expect(customEmptyState).toBeInTheDocument()
    expect(customEmptyState).not.toHaveClass("border")
    for (const emptyVersion of screen.getAllByText("Zatím není nahraná žádná verze.")) {
      expect(emptyVersion).not.toHaveClass("border", "border-dashed")
    }
  })

  it("lists custom documents and their immutable versions newest first", () => {
    const { container } = render(
      <TeamDocuments
        teamId="team-1"
        initialDocuments={[
          documentRow({
            versions: [
              {
                id: "version-2",
                document_id: "document-1",
                version_no: 2,
                file_path: "team-document/document-1/v2.pdf",
                file_name: "pravidla-v2.pdf",
                file_size: 2048,
                effective_from: "2026-09-01",
                change_note: "Doplněné role",
                created_at: "2026-08-19T11:00:00Z",
                created_by_profile_id: "profile-1",
                created_by: { id: "profile-1", name: "Alex", picture: null },
              },
              {
                id: "version-1",
                document_id: "document-1",
                version_no: 1,
                file_path: "team-document/document-1/v1.pdf",
                file_name: "pravidla-v1.pdf",
                file_size: 1024,
                effective_from: null,
                change_note: null,
                created_at: "2026-08-18T11:00:00Z",
                created_by_profile_id: "profile-1",
                created_by: { id: "profile-1", name: "Alex", picture: null },
              },
            ],
          }),
        ]}
      />,
    )

    expect(screen.getByRole("heading", { name: "Pravidla porad", level: 3 })).toBeInTheDocument()
    expect(screen.getAllByText("Verze 2").length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: "Otevřít aktuální verzi" })).toHaveAttribute(
      "href",
      "/api/team-documents/versions/version-2/open",
    )
    expect(container.querySelectorAll("div.border")).toHaveLength(2)
    expect(screen.getByText("Historie verzí (2)").closest("details")).not.toHaveClass("border")
    expect(screen.getByRole("button", { name: "Přejmenovat" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Archivovat" })).toBeInTheDocument()
  })

  it("rejects non-PDF uploads before making a request", async () => {
    const user = userEvent.setup()
    render(
      <TeamDocuments
        teamId="team-1"
        initialDocuments={[documentRow()]}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Nahrát novou verzi" }))
    await user.upload(
      screen.getByLabelText("Soubor PDF"),
      new File(["image"], "rules.png", { type: "image/png" }),
    )
    await user.click(screen.getByRole("button", { name: "Nahrát verzi" }))

    expect(screen.getByText("Vyberte soubor ve formátu PDF.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uploads a new version through presign, storage and metadata requests", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { url: "https://storage.example/upload", key: "team-document/document-1/v2.pdf" },
        }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: "version-2",
            document_id: "document-1",
            version_no: 2,
            file_path: "team-document/document-1/v2.pdf",
            file_name: "rules.pdf",
            file_size: 3,
            effective_from: null,
            change_note: null,
            created_at: "2026-08-19T12:00:00Z",
            created_by_profile_id: "profile-1",
            created_by: { id: "profile-1", name: "Alex", picture: null },
          },
        }),
      })
    const user = userEvent.setup()
    render(<TeamDocuments teamId="team-1" initialDocuments={[documentRow()]} />)

    await user.click(screen.getByRole("button", { name: "Nahrát novou verzi" }))
    await user.upload(
      screen.getByLabelText("Soubor PDF"),
      new File(["pdf"], "rules.pdf", { type: "application/pdf" }),
    )
    await user.click(screen.getByRole("button", { name: "Nahrát verzi" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[0][0]).toBe("/api/storage/presign-upload")
    expect(fetchMock.mock.calls[1][0]).toBe("https://storage.example/upload")
    expect(fetchMock.mock.calls[2][0]).toBe("/api/team-documents/document-1/versions")
    expect(successToast).toHaveBeenCalledWith("Nová verze je nahraná")
  })

  it("archives a custom document after confirmation", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    const user = userEvent.setup()
    render(<TeamDocuments teamId="team-1" initialDocuments={[documentRow()]} />)

    await user.click(screen.getByRole("button", { name: "Archivovat" }))
    expect(screen.getByText("Archivovat dokument?")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Potvrdit archivaci" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/team-documents/document-1", {
        method: "DELETE",
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Pravidla porad" })).not.toBeInTheDocument()
    })
  })
})
