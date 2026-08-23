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
  it("always renders the two core featured document slots (Team Contract and Finanční směrnice)", () => {
    render(<TeamDocuments initialDocuments={[]} teamId="team-1" />)

    expect(screen.getByRole("heading", { name: "Team Contract" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Finanční směrnice" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Nahrát první verzi" })).toHaveLength(2)
    expect(screen.getByText("Zatím žádné další dokumenty")).toBeInTheDocument()
    expect(screen.getAllByText("Zatím není nahraná žádná verze.")).toHaveLength(2)
  })

  it("lists custom documents and shows version information", async () => {
    const user = userEvent.setup()
    render(
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
    expect(screen.getByText("Verze 2")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Otevřít Pravidla porad" })).toHaveAttribute(
      "href",
      "/api/team-documents/versions/version-2/open",
    )

    // Open options dropdown
    await user.click(screen.getByRole("button", { name: "Možnosti pro dokument Pravidla porad" }))
    expect(screen.getByRole("menuitem", { name: "Nahrát novou verzi" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Historie verzí (2)" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Přejmenovat" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Archivovat" })).toBeInTheDocument()
  })

  it("opens version history dialog and displays all versions", async () => {
    const user = userEvent.setup()
    render(
      <TeamDocuments
        teamId="team-1"
        initialDocuments={[
          documentRow({
            doc_type: "team_contract",
            title: null,
            versions: [
              {
                id: "tc-v2",
                document_id: "document-1",
                version_no: 2,
                file_path: "team-document/document-1/v2.pdf",
                file_name: "contract-v2.pdf",
                file_size: 2048,
                effective_from: "2026-09-01",
                change_note: "Doplněna docházka",
                created_at: "2026-08-19T11:00:00Z",
                created_by_profile_id: "profile-1",
                created_by: { id: "profile-1", name: "Alex", picture: null },
              },
              {
                id: "tc-v1",
                document_id: "document-1",
                version_no: 1,
                file_path: "team-document/document-1/v1.pdf",
                file_name: "contract-v1.pdf",
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

    await user.click(screen.getByRole("button", { name: "Historie (2)" }))

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Historie verzí · Team Contract")).toBeInTheDocument()
    expect(screen.getByText("Aktuální")).toBeInTheDocument()
    expect(screen.getByText("Doplněna docházka")).toBeInTheDocument()
  })

  it("rejects non-PDF uploads before making a request", async () => {
    const user = userEvent.setup()
    render(
      <TeamDocuments
        teamId="team-1"
        initialDocuments={[documentRow()]}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Možnosti pro dokument Pravidla porad" }))
    await user.click(screen.getByRole("menuitem", { name: "Nahrát novou verzi" }))
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

    await user.click(screen.getByRole("button", { name: "Možnosti pro dokument Pravidla porad" }))
    await user.click(screen.getByRole("menuitem", { name: "Nahrát novou verzi" }))
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

    await user.click(screen.getByRole("button", { name: "Možnosti pro dokument Pravidla porad" }))
    await user.click(screen.getByRole("menuitem", { name: "Archivovat" }))
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
