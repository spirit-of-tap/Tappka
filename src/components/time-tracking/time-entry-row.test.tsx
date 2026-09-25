import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { TimeEntryWithTag } from "@/lib/time-tracking/types"

import { RunningEntryRow, TimeEntryRow } from "./time-entry-row"

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

function makeEntry(overrides: Partial<TimeEntryWithTag> = {}): TimeEntryWithTag {
  return {
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
    // 10:00–11:30 Prague (CEST)
    started_at: "2026-09-24T08:00:00Z",
    ended_at: "2026-09-24T09:30:00Z",
    duration_ms: 90 * 60_000,
    created_at: "2026-09-24T09:30:00Z",
    updated_at: "2026-09-24T09:30:00Z",
    ...overrides,
  }
}

describe("TimeEntryRow", () => {
  const fetchMock = vi.fn<typeof fetch>()

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

  it("renders title, tag, Prague time range and duration", () => {
    render(<TimeEntryRow entry={makeEntry({ tag_id: "t1", tag: { id: "t1", name: "Kniha" } })} />)

    expect(screen.getByText("Lean Startup")).toBeInTheDocument()
    expect(screen.getByText("Kniha")).toBeInTheDocument()
    expect(screen.getByText(/10:00–11:30/)).toBeInTheDocument()
    expect(screen.getByText("1 h 30 min")).toBeInTheDocument()
    expect(screen.queryByText("z docházky")).not.toBeInTheDocument()
  })

  it("falls back to the direction label and marks attendance entries", () => {
    render(<TimeEntryRow entry={makeEntry({ title: null, direction: "training", source: "attendance" })} />)

    expect(screen.getByText("Training")).toBeInTheDocument()
    expect(screen.getByText("z docházky")).toBeInTheDocument()
  })

  it("notes an entry that ends on the next day", () => {
    render(
      <TimeEntryRow
        entry={makeEntry({
          // 23:00 → 01:00 Prague
          started_at: "2026-09-24T21:00:00Z",
          ended_at: "2026-09-24T23:00:00Z",
          duration_ms: 2 * 3_600_000,
        })}
      />,
    )

    expect(screen.getByText(/23:00–01:00/)).toBeInTheDocument()
    expect(screen.getByText("→ následující den")).toBeInTheDocument()
  })

  it("opens the edit dialog via Upravit", async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const entry = makeEntry()
    render(<TimeEntryRow entry={entry} onEdit={onEdit} />)

    await user.click(screen.getByRole("button", { name: "Další akce: Lean Startup" }))
    await user.click(await screen.findByRole("menuitem", { name: "Upravit" }))

    expect(onEdit).toHaveBeenCalledWith(entry)
  })

  it("deletes after confirmation, optimistically", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: null }), { status: 200 }))
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    const entry = makeEntry()
    render(<TimeEntryRow entry={entry} onDeleted={onDeleted} />)

    await user.click(screen.getByRole("button", { name: "Další akce: Lean Startup" }))
    await user.click(await screen.findByRole("menuitem", { name: "Smazat" }))
    expect(await screen.findByText("Smazat záznam?")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Smazat" }))

    expect(onDeleted).toHaveBeenCalledWith(entry.id)
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Záznam smazán"))
    expect(fetchMock).toHaveBeenCalledWith(`/api/time-entries/${entry.id}`, { method: "DELETE" })
    expect(refresh).toHaveBeenCalled()
  })

  it("restores the entry when deleting fails", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Záznam nenalezen" }), { status: 404 }))
    const user = userEvent.setup()
    const onDeleteFailed = vi.fn()
    const entry = makeEntry()
    render(<TimeEntryRow entry={entry} onDeleteFailed={onDeleteFailed} />)

    await user.click(screen.getByRole("button", { name: "Další akce: Lean Startup" }))
    await user.click(await screen.findByRole("menuitem", { name: "Smazat" }))
    await user.click(await screen.findByRole("button", { name: "Smazat" }))

    await waitFor(() => expect(onDeleteFailed).toHaveBeenCalledWith(entry))
    expect(toastError).toHaveBeenCalledWith("Záznam nenalezen")
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe("RunningEntryRow", () => {
  it("shows the live elapsed time and a Stop button without a menu", async () => {
    const user = userEvent.setup()
    const onStop = vi.fn()
    render(
      <RunningEntryRow
        entry={makeEntry({ ended_at: null, duration_ms: null, source: "timer" })}
        elapsedMs={(3_600 + 125) * 1_000}
        onStop={onStop}
      />,
    )

    expect(screen.getByText("01:02:05")).toBeInTheDocument()
    expect(screen.getByTestId("running-dot")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Další akce/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Stop" }))
    expect(onStop).toHaveBeenCalled()
  })
})
