import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TITLE_PLACEHOLDER } from "@/lib/time-tracking/constants"
import type { TagCatalog, TimeEntryWithTag, TimeTag } from "@/lib/time-tracking/types"

import { EntryFormDialog, buildEntryPayload } from "./entry-form-dialog"

const refresh = vi.fn()
const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn() }),
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  }),
}))

// 2026-09-25 14:07 Prague (CEST) → defaults 13:00–14:00.
const NOW = new Date("2026-09-25T12:07:00Z")

const ENTRY: TimeEntryWithTag = {
  id: "11111111-1111-4111-8111-111111111111",
  profile_id: "p1",
  created_by_profile_id: "p1",
  updated_by_profile_id: "p1",
  attendance_id: null,
  direction: "reading",
  source: "manual",
  title: "Lean Startup",
  tag_id: "reading",
  tag: { id: "reading", name: "Čtení", direction: "reading" },
  started_at: "2026-09-24T08:00:00Z",
  ended_at: "2026-09-24T09:30:00Z",
  duration_ms: 90 * 60_000,
  created_at: "2026-09-24T09:30:00Z",
  updated_at: "2026-09-24T09:30:00Z",
}

function systemTag(id: string, name: string, direction: "training" | "reading"): TimeTag {
  return {
    id,
    name,
    direction,
    team_id: null,
    system_key: id,
    created_by_profile_id: null,
    updated_by_profile_id: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  }
}

/** System tags only, passed in so the picker never fetches (and pre-selects TS / Čtení). */
const TAG_CATALOG: TagCatalog = {
  tags: [
    systemTag("training_session", "TS", "training"),
    systemTag("training_session_prep", "Příprava na TS", "training"),
    systemTag("reading", "Čtení", "reading"),
    systemTag("essay", "Esej", "reading"),
  ],
  selectedTagIds: [],
  newTagCount: 0,
}

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function lastRequest(): { url: string; method: string | undefined; body: Record<string, unknown> } {
  const [url, init] = fetchMock.mock.calls.at(-1) ?? []
  return {
    url: String(url),
    method: init?.method,
    body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
  }
}

function renderDialog(entry: TimeEntryWithTag | null = null) {
  const onOpenChange = vi.fn()
  const onSaved = vi.fn()
  render(<EntryFormDialog open onOpenChange={onOpenChange} entry={entry} now={NOW} tagCatalog={TAG_CATALOG} onSaved={onSaved} />)
  return { onOpenChange, onSaved }
}

describe("EntryFormDialog", () => {
  beforeEach(() => {
    refresh.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("prefills the last hour and previews the duration", () => {
    renderDialog()

    expect(screen.getByLabelText("Začátek")).toHaveValue("2026-09-25")
    expect(screen.getByLabelText("Čas začátku")).toHaveValue("13:00")
    expect(screen.getByLabelText("Čas konce")).toHaveValue("14:00")
    expect(screen.getByTestId("duration-preview")).toHaveTextContent("1 h")

    fireEvent.change(screen.getByLabelText("Čas konce"), { target: { value: "14:45" } })
    expect(screen.getByTestId("duration-preview")).toHaveTextContent("1 h 45 min")
  })

  it("requires a direction", async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole("button", { name: "Uložit" }))

    expect(await screen.findByText("Vyber směr")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("blocks an end before the start", async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole("radio", { name: "Training" }))
    fireEvent.change(screen.getByLabelText("Čas konce"), { target: { value: "12:00" } })
    await user.click(screen.getByRole("button", { name: "Uložit" }))

    expect(await screen.findByText("Konec musí být po začátku")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("creates an entry across midnight with explicit offsets", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { ...ENTRY, id: "new" } }, 201))
    const user = userEvent.setup()
    const { onOpenChange, onSaved } = renderDialog()

    await user.click(screen.getByRole("radio", { name: "Practise" }))
    await user.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), "  Stánek  ")
    fireEvent.change(screen.getByLabelText("Začátek"), { target: { value: "2026-09-24" } })
    fireEvent.change(screen.getByLabelText("Čas začátku"), { target: { value: "23:30" } })
    fireEvent.change(screen.getByLabelText("Konec"), { target: { value: "2026-09-25" } })
    fireEvent.change(screen.getByLabelText("Čas konce"), { target: { value: "00:15" } })
    expect(screen.getByTestId("duration-preview")).toHaveTextContent("45 min")

    await user.click(screen.getByRole("button", { name: "Uložit" }))

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Záznam uložen"))
    expect(lastRequest()).toEqual({
      url: "/api/time-entries",
      method: "POST",
      body: {
        direction: "practise",
        tagId: null,
        title: "Stánek",
        startedAt: "2026-09-24T23:30:00+02:00",
        endedAt: "2026-09-25T00:15:00+02:00",
      },
    })
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "new" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(refresh).toHaveBeenCalled()
  })

  it("shows an overlap error under the end field and stays open", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Záznam se překrývá s jiným záznamem" }, 409))
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()

    await user.click(screen.getByRole("radio", { name: "Practise" }))
    await user.click(screen.getByRole("button", { name: "Uložit" }))

    expect(await screen.findByText("Záznam se překrývá s jiným záznamem")).toBeInTheDocument()
    expect(screen.getByLabelText("Čas konce")).toHaveAttribute("aria-invalid", "true")
    expect(toastError).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("toasts other API errors", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Neplatný tag" }, 422))
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole("radio", { name: "Practise" }))
    await user.click(screen.getByRole("button", { name: "Uložit" }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Neplatný tag"))
  })

  it("pre-selects Čtení for a new Reading entry", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { ...ENTRY, id: "new" } }, 201))
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole("radio", { name: "Reading" }))
    expect(screen.getByRole("combobox", { name: "Tag" })).toHaveTextContent("Čtení")
    await user.click(screen.getByRole("button", { name: "Uložit" }))

    await waitFor(() => expect(lastRequest().body).toMatchObject({ direction: "reading", tagId: "reading" }))
  })

  it("pre-selects TS when an entry is switched to Training", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: ENTRY }, 200))
    const user = userEvent.setup()
    renderDialog({ ...ENTRY, direction: "practise", tag_id: null, tag: null })

    await user.click(screen.getByRole("radio", { name: "Training" }))
    expect(screen.getByRole("combobox", { name: "Tag" })).toHaveTextContent("TS")
    await user.click(screen.getByRole("button", { name: "Uložit" }))

    await waitFor(() => expect(lastRequest().body).toEqual({ direction: "training", tagId: "training_session" }))
  })

  it("edits with PATCH sending only changed fields", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { ...ENTRY, title: "Lean Startup, kap. 3" } }, 200))
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog(ENTRY)

    expect(screen.getByRole("radio", { name: "Reading" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByLabelText("Čas začátku")).toHaveValue("10:00")
    expect(screen.getByLabelText("Čas konce")).toHaveValue("11:30")

    await user.type(screen.getByPlaceholderText(TITLE_PLACEHOLDER), ", kap. 3")
    await user.click(screen.getByRole("button", { name: "Uložit" }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(lastRequest()).toEqual({
      url: `/api/time-entries/${ENTRY.id}`,
      method: "PATCH",
      body: { title: "Lean Startup, kap. 3" },
    })
  })

  it("drops the tag when the direction changes, because tags belong to one direction", async () => {
    const tagged: TimeEntryWithTag = ENTRY
    fetchMock.mockResolvedValue(jsonResponse({ data: { ...tagged, direction: "project", tag_id: null, tag: null } }, 200))
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog(tagged)

    await user.click(screen.getByRole("radio", { name: "Projekt" }))
    expect(screen.getByRole("combobox", { name: "Tag" })).toHaveTextContent("Bez tagu")
    await user.click(screen.getByRole("button", { name: "Uložit" }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(lastRequest().body).toEqual({ direction: "project", tagId: null })
  })

  it("closes without a request when nothing changed", async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog(ENTRY)

    await user.click(screen.getByRole("button", { name: "Uložit" }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("buildEntryPayload", () => {
  const values = {
    direction: "project" as const,
    tagId: null,
    newTagName: "Kavárna",
    title: "",
    startDate: "2026-09-24",
    startTime: "10:00",
    endDate: "2026-09-24",
    endTime: "11:30",
  }

  it("sends a draft tag name instead of tagId for a new entry", () => {
    expect(buildEntryPayload(values, null)).toEqual({
      direction: "project",
      newTagName: "Kavárna",
      title: null,
      startedAt: "2026-09-24T10:00:00+02:00",
      endedAt: "2026-09-24T11:30:00+02:00",
    })
  })

  it("sends only the draft tag name when editing", () => {
    const entry = { ...ENTRY, direction: "project" as const, title: null, tag_id: null, tag: null }
    expect(buildEntryPayload(values, entry)).toEqual({ newTagName: "Kavárna" })
  })
})
