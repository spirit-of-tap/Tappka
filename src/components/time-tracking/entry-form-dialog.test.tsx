import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TITLE_PLACEHOLDER } from "@/lib/time-tracking/constants"
import type { TimeEntryWithTag } from "@/lib/time-tracking/types"

import { EntryFormDialog } from "./entry-form-dialog"

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
  tag_id: null,
  tag: null,
  started_at: "2026-09-24T08:00:00Z",
  ended_at: "2026-09-24T09:30:00Z",
  duration_ms: 90 * 60_000,
  created_at: "2026-09-24T09:30:00Z",
  updated_at: "2026-09-24T09:30:00Z",
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
  render(<EntryFormDialog open onOpenChange={onOpenChange} entry={entry} now={NOW} tags={[]} onSaved={onSaved} />)
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

    await user.click(screen.getByRole("radio", { name: "Reading" }))
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

    await user.click(screen.getByRole("radio", { name: "Reading" }))
    await user.click(screen.getByRole("button", { name: "Uložit" }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Neplatný tag"))
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

  it("closes without a request when nothing changed", async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog(ENTRY)

    await user.click(screen.getByRole("button", { name: "Uložit" }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
