import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { TeamMember, TimeEntryWithTag, TimeTag } from "@/lib/time-tracking/types"

import { ReportingView } from "./reporting-view"

const downloadCsv = vi.fn()

vi.mock("./chart-export", async () => {
  const actual = await vi.importActual<typeof import("./chart-export")>("./chart-export")
  return { ...actual, downloadCsv: (...args: unknown[]) => downloadCsv(...args), exportChartAsPng: vi.fn() }
})

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

// ResponsiveContainer measures 0×0 in jsdom; give the chart a fixed size.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts")
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement<{ width?: number; height?: number }> }) => (
      <div>{React.cloneElement(children, { width: 600, height: 360 })}</div>
    ),
  }
})

const HOUR = 3_600_000
const NOW = new Date("2026-10-11T12:00:00Z")
const RANGE = { from: "2026-10-05", to: "2026-10-11" }
const INSTANTS = { from: new Date("2026-10-04T22:00:00Z"), to: new Date("2026-10-11T22:00:00Z") }

const MEMBERS: TeamMember[] = [
  { id: "p-anna", name: "Anna Nováková", picture: null },
  { id: "p-beda", name: "Béďa Kos", picture: null },
]

const FELLA: TimeTag = {
  id: "t-fella",
  name: "Fellaship",
  direction: "practise",
  team_id: "team-1",
  system_key: null,
  created_by_profile_id: "p-anna",
  updated_by_profile_id: "p-anna",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
}

const ENTRIES: TimeEntryWithTag[] = [
  {
    id: "e1",
    profile_id: "p-anna",
    direction: "practise",
    tag_id: FELLA.id,
    tag: { id: FELLA.id, name: FELLA.name, direction: "practise" },
    title: null,
    started_at: "2026-10-06T08:00:00Z",
    ended_at: "2026-10-06T10:00:00Z",
    duration_ms: 2 * HOUR,
    source: "manual",
    attendance_id: null,
    created_at: "2026-10-06T10:00:00Z",
    updated_at: "2026-10-06T10:00:00Z",
    created_by_profile_id: "p-anna",
    updated_by_profile_id: "p-anna",
  },
]

beforeEach(() => {
  downloadCsv.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

function renderView() {
  const user = userEvent.setup()
  render(
    <ReportingView
      teamName="PAVIAAN"
      members={MEMBERS}
      entries={ENTRIES}
      tags={[FELLA]}
      range={RANGE}
      instants={INSTANTS}
      now={NOW}
    />,
  )
  return { user }
}

describe("ReportingView", () => {
  it("starts with one chart of all four directions", () => {
    renderView()
    const legend = screen.getByRole("list", { name: "Legenda" })
    expect(within(legend).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Training",
      "Reading",
      "Practise",
      "Projekt",
    ])
    expect(screen.getByRole("button", { name: /Osa Y: 4/ })).toBeInTheDocument()
  })

  it("lets the Y axis show a tag instead of directions", async () => {
    const { user } = renderView()
    await user.click(screen.getByRole("button", { name: /Osa Y/ }))
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Fellaship" }))
    for (const name of ["Training", "Reading", "Practise", "Projekt"]) {
      await user.click(screen.getByRole("menuitemcheckbox", { name }))
    }
    await user.keyboard("{Escape}")

    const legend = screen.getByRole("list", { name: "Legenda" })
    expect(within(legend).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Fellaship"])
  })

  it("exports the chart data as CSV named after team, period and chart", async () => {
    const { user } = renderView()
    await user.click(screen.getByRole("button", { name: "CSV" }))

    expect(downloadCsv).toHaveBeenCalledWith(
      expect.stringContaining("Anna Nováková,0,0,2,0,2"),
      "cas-paviaan-2026-10-05-2026-10-11-cas-podle-smeru.csv",
    )
  })

  it("adds and removes charts", async () => {
    const { user } = renderView()
    await user.click(screen.getByRole("button", { name: "Přidat graf" }))
    expect(screen.getByDisplayValue("Graf 2")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Odebrat graf Graf 2" }))
    expect(screen.queryByDisplayValue("Graf 2")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Odebrat graf/ })).not.toBeInTheDocument()
  })

  it("exports all entries of the period as CSV", async () => {
    const { user } = renderView()
    await user.click(screen.getByRole("button", { name: "Všechny záznamy (CSV)" }))

    expect(downloadCsv).toHaveBeenCalledWith(
      expect.stringContaining("Anna Nováková,Practise,Fellaship"),
      "cas-paviaan-2026-10-05-2026-10-11-zaznamy.csv",
    )
  })
})
