import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import type { TeamMember, TimeEntryWithTag } from "@/lib/time-tracking/types"
import { getWeekRange } from "@/lib/time-tracking/week"

import { TeamTimeTable, buildMemberRows } from "./team-time-table"

// Thursday 24. 9. 2026, 12:00 Prague (CEST, UTC+2).
const NOW = new Date("2026-09-24T10:00:00Z")
const WEEK = getWeekRange(NOW)
// formatMetricValue renders a no-break space, but testing-library normalizes it to a plain space.
const NBSP = " "
// Accessible names are not normalized, so the aria-label keeps the real no-break space.
const NBSP_RAW = " "

const MEMBERS: TeamMember[] = [
  { id: "a", name: "Anna Adamová", picture: null },
  { id: "b", name: "Bára Bílá", picture: null },
  { id: "c", name: "Cyril Černý", picture: null },
]

function makeEntry(
  overrides: Partial<TimeEntryWithTag> & Pick<TimeEntryWithTag, "id" | "profile_id" | "started_at" | "ended_at">,
): TimeEntryWithTag {
  const durationMs =
    overrides.ended_at === null ? null : Date.parse(overrides.ended_at) - Date.parse(overrides.started_at)
  return {
    attendance_id: null,
    created_at: "2026-09-20T00:00:00Z",
    created_by_profile_id: overrides.profile_id,
    direction: "training",
    duration_ms: durationMs,
    source: "manual",
    tag_id: null,
    title: null,
    updated_at: "2026-09-20T00:00:00Z",
    updated_by_profile_id: overrides.profile_id,
    tag: null,
    ...overrides,
  }
}

const ENTRIES: TimeEntryWithTag[] = [
  // Anna: 4 h training (tagged) + 1,5 h reading = 5,5 h
  makeEntry({
    id: "a1",
    profile_id: "a",
    direction: "training",
    title: "Workshop",
    tag_id: "t1",
    tag: { id: "t1", name: "Klient X" },
    started_at: "2026-09-22T06:00:00Z",
    ended_at: "2026-09-22T10:00:00Z",
  }),
  makeEntry({
    id: "a2",
    profile_id: "a",
    direction: "reading",
    started_at: "2026-09-23T18:00:00Z",
    ended_at: "2026-09-23T19:30:00Z",
  }),
  // Bára: running practise timer (2 h up to NOW) + 1 h clipped from an entry
  // that started on Sunday night of the previous week.
  makeEntry({
    id: "b1",
    profile_id: "b",
    direction: "practise",
    started_at: "2026-09-24T08:00:00Z",
    ended_at: null,
  }),
  makeEntry({
    id: "b2",
    profile_id: "b",
    direction: "practise",
    started_at: "2026-09-20T20:00:00Z",
    ended_at: "2026-09-20T23:00:00Z",
  }),
]

function renderTable() {
  return render(
    <TeamTimeTable members={MEMBERS} entries={ENTRIES} week={WEEK} now={NOW} weeklyTargetHours={40} />,
  )
}

function rowTrigger(name: string): HTMLElement {
  const trigger = screen.getAllByRole("button").find((button) => button.textContent?.includes(name))
  if (!trigger) throw new Error(`Row for ${name} not found`)
  return trigger
}

describe("buildMemberRows", () => {
  it("sums per member incl. running timers, clipped to the week, sorted by total desc", () => {
    const rows = buildMemberRows(MEMBERS, ENTRIES, WEEK, NOW)
    expect(rows.map((row) => row.member.id)).toEqual(["a", "b", "c"])
    expect(rows[0].summary.totalMs).toBe(5.5 * 3_600_000)
    expect(rows[1].summary.totalMs).toBe(3 * 3_600_000)
    expect(rows[1].isRunning).toBe(true)
    expect(rows[2].summary.totalMs).toBe(0)
  })
})

describe("TeamTimeTable", () => {
  it("lists members by total with zero-time members last", () => {
    renderTable()
    const items = screen.getAllByRole("listitem")
    expect(items.map((item) => within(item).getByText(/^(Anna|Bára|Cyril)/).textContent)).toEqual([
      "Anna Adamová",
      "Bára Bílá",
      "Cyril Černý",
    ])
  })

  it("shows direction columns and totals in hours", () => {
    renderTable()
    const anna = rowTrigger("Anna Adamová")
    expect(within(anna).getAllByText(`4${NBSP}h`).length).toBeGreaterThan(0)
    expect(within(anna).getAllByText(`1,5${NBSP}h`).length).toBeGreaterThan(0)
    expect(within(anna).getByText(`5,5${NBSP}h`)).toBeInTheDocument()
  })

  it("marks only members with a running timer", () => {
    renderTable()
    expect(within(rowTrigger("Bára Bílá")).getByText("běží")).toBeInTheDocument()
    expect(within(rowTrigger("Anna Adamová")).queryByText("běží")).not.toBeInTheDocument()
  })

  it("renders a progress bar toward the weekly target", () => {
    renderTable()
    expect(screen.getByRole("progressbar", { name: `Anna Adamová: 5,5${NBSP_RAW}h z 40${NBSP_RAW}h` })).toBeInTheDocument()
  })

  it("shows team total and average per member in the footer", () => {
    renderTable()
    expect(screen.getByTestId("team-total")).toHaveTextContent(`8,5${NBSP}h`)
    expect(screen.getByTestId("team-average")).toHaveTextContent(`Průměr na osobu 2,8${NBSP}h`)
  })

  it("expands a row into read-only entries grouped by day", async () => {
    const user = userEvent.setup()
    renderTable()
    expect(screen.queryByText("Workshop")).not.toBeInTheDocument()

    await user.click(rowTrigger("Anna Adamová"))

    expect(screen.getByText("Workshop")).toBeInTheDocument()
    expect(screen.getByText("Klient X")).toBeInTheDocument()
    expect(screen.getByText("úterý 22. 9.")).toBeInTheDocument()
    expect(screen.getByText("středa 23. 9.")).toBeInTheDocument()
    // Untitled entry falls back to the direction label.
    expect(screen.getAllByText("Reading").length).toBeGreaterThan(1)
    expect(screen.getByText("8:00–12:00")).toBeInTheDocument()
    expect(screen.getByText("1 h 30 min")).toBeInTheDocument()
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("shows an empty note for members without entries", async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(rowTrigger("Cyril Černý"))
    expect(screen.getByText("Tento týden bez záznamů.")).toBeInTheDocument()
  })
})
