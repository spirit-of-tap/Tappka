import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import type { TagCatalog, TimeEntryWithTag } from "@/lib/time-tracking/types"

import { TimeCalendar } from "./time-calendar"

const refresh = vi.fn()
const push = vi.fn()
const toastError = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push, replace: vi.fn() }),
  usePathname: () => "/cas/kalendar",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: (...args: unknown[]) => toastError(...args) }),
}))

const HOUR_PX = 48
const WEEK_START = "2026-10-05"
const NOW = new Date("2026-10-08T10:00:00Z")
const CATALOG: TagCatalog = { tags: [], selectedTagIds: [], newTagCount: 0 }

const ENTRY: TimeEntryWithTag = {
  id: "11111111-1111-4111-8111-111111111111",
  profile_id: "p1",
  direction: "practise",
  tag_id: null,
  tag: null,
  title: "Stánek",
  // Tue 6. 10. 9:00–10:00 Prague.
  started_at: "2026-10-06T07:00:00Z",
  ended_at: "2026-10-06T08:00:00Z",
  duration_ms: 3_600_000,
  source: "manual",
  attendance_id: null,
  created_at: "2026-10-06T08:00:00Z",
  updated_at: "2026-10-06T08:00:00Z",
  created_by_profile_id: "p1",
  updated_by_profile_id: "p1",
}

const fetchMock = vi.fn<typeof fetch>()

/** jsdom has no layout: give each day column a 100 px wide box starting at the top. */
function mockColumnRects() {
  const days = ["05", "06", "07", "08", "09", "10", "11"]
  days.forEach((day, index) => {
    const column = screen.getByTestId(`calendar-day-2026-10-${day}`)
    column.getBoundingClientRect = () =>
      ({ top: 0, bottom: 24 * HOUR_PX, left: 48 + index * 100, right: 148 + index * 100, width: 100, height: 24 * HOUR_PX, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  })
}

function renderCalendar(entries: TimeEntryWithTag[] = [ENTRY]) {
  render(<TimeCalendar entries={entries} tagCatalog={CATALOG} weekStartKey={WEEK_START} todayKey="2026-10-08" now={NOW} />)
  mockColumnRects()
}

beforeEach(() => {
  fetchMock.mockReset()
  refresh.mockReset()
  toastError.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("TimeCalendar", () => {
  it("shows the week and places an entry by its Prague time", () => {
    renderCalendar()
    const block = screen.getByRole("button", { name: "Stánek, 09:00–10:00" })
    expect(block).toHaveStyle({ top: `${9 * HOUR_PX}px`, height: `${HOUR_PX}px` })
    for (const day of ["5. 10.", "6. 10.", "11. 10."]) expect(screen.getByText(day)).toBeInTheDocument()
  })

  it("opens the edit dialog on a click without dragging", async () => {
    renderCalendar()
    const block = screen.getByRole("button", { name: "Stánek, 09:00–10:00" })
    fireEvent.pointerDown(block, { button: 0, clientX: 200, clientY: 9 * HOUR_PX + 10, pointerType: "mouse" })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { clientX: 200, clientY: 9 * HOUR_PX + 10 }))
    })

    expect(await screen.findByRole("heading", { name: "Upravit záznam" })).toBeInTheDocument()
  })

  it("moves an entry by dragging it to another day and time", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: ENTRY }), { status: 200 }))
    renderCalendar()
    const block = screen.getByRole("button", { name: "Stánek, 09:00–10:00" })

    // Grab on Tuesday 9:15, drop on Wednesday 11:15 (+1 day, +2 h).
    fireEvent.pointerDown(block, { button: 0, clientX: 190, clientY: 9.25 * HOUR_PX, pointerType: "mouse" })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 290, clientY: 11.25 * HOUR_PX }))
    })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { clientX: 290, clientY: 11.25 * HOUR_PX }))
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(`/api/time-entries/${ENTRY.id}`)
    expect(JSON.parse(String(init?.body))).toEqual({
      startedAt: "2026-10-07T09:00:00.000Z",
      endedAt: "2026-10-07T10:00:00.000Z",
    })
  })

  it("puts the block back and shows the API error when a move overlaps", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Záznam se překrývá s jiným záznamem" }), { status: 409 }))
    renderCalendar()
    const block = screen.getByRole("button", { name: "Stánek, 09:00–10:00" })

    fireEvent.pointerDown(block, { button: 0, clientX: 190, clientY: 9.25 * HOUR_PX, pointerType: "mouse" })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 190, clientY: 10.25 * HOUR_PX }))
    })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { clientX: 190, clientY: 10.25 * HOUR_PX }))
    })

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Záznam se překrývá s jiným záznamem"))
    expect(screen.getByRole("button", { name: "Stánek, 09:00–10:00" })).toBeInTheDocument()
  })

  it("drag on an empty slot opens the create dialog with that time", async () => {
    renderCalendar([])
    const thursday = screen.getByTestId("calendar-day-2026-10-08")

    fireEvent.pointerDown(thursday, { button: 0, clientX: 400, clientY: 13 * HOUR_PX, pointerType: "mouse" })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 400, clientY: 14.5 * HOUR_PX }))
    })
    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { clientX: 400, clientY: 14.5 * HOUR_PX }))
    })

    expect(await screen.findByRole("heading", { name: "Zapsat čas ručně" })).toBeInTheDocument()
    expect(screen.getByLabelText("Začátek")).toHaveValue("2026-10-08")
    expect(screen.getByLabelText("Čas začátku")).toHaveValue("13:00")
    expect(screen.getByLabelText("Čas konce")).toHaveValue("14:30")
  })
})
