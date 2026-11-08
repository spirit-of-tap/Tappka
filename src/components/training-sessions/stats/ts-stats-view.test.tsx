import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { StatsPerson, StatsSession } from "@/lib/training-sessions/stats"

import { TsStatsView } from "./ts-stats-view"

const downloadCsv = vi.fn()

vi.mock("@/components/time-tracking/chart-export", async () => {
  const actual = await vi.importActual<typeof import("@/components/time-tracking/chart-export")>(
    "@/components/time-tracking/chart-export",
  )
  return { ...actual, downloadCsv: (...args: unknown[]) => downloadCsv(...args), exportChartAsPng: vi.fn() }
})

// ResponsiveContainer measures 0×0 in jsdom; give the chart a fixed size.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts")
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement<{ width?: number; height?: number }> }) => (
      <div>{React.cloneElement(children, { width: 600, height: 300 })}</div>
    ),
  }
})

const A: StatsPerson = { id: "a", name: "Adéla Malá" }
const B: StatsPerson = { id: "b", name: "Bára Velká" }
const HOUR_MS = 60 * 60 * 1000

function session(id: string, overrides: Partial<StatsSession> = {}): StatsSession {
  const startsAt = "2026-11-03T10:00:00.000Z"
  return {
    id,
    topic: `Téma ${id}`,
    startsAt,
    facilitators: [A],
    preparationPublishedAt: new Date(new Date(startsAt).getTime() - 57.6 * HOUR_MS).toISOString(),
    attendance: [{ profileId: "a", status: "present" }],
    ...overrides,
  }
}

const base = {
  teamName: "Tým Alfa",
  rangeLabel: "1. 9. – 31. 1. 2027",
  fileNamePrefix: "ts-tym-alfa",
  members: [A, B],
  sessions: [session("s1"), session("s2")],
  showAttendance: true,
}

describe("TsStatsView", () => {
  it("shows an empty state when there are no sessions", () => {
    render(<TsStatsView {...base} sessions={[]} />)
    expect(screen.getByText("V tomhle období zatím žádné TS neproběhlo")).toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  })

  it("renders the three sections with the average lead time", () => {
    render(<TsStatsView {...base} />)
    expect(screen.getByRole("heading", { name: "Facilitace" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Příprava" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Docházka" })).toBeInTheDocument()
    expect(screen.getByText(/V průměru 2,4 dne předem/)).toBeInTheDocument()
  })

  it("reports TS without attendance", () => {
    render(<TsStatsView {...base} sessions={[session("s1", { attendance: [] }), session("s2")]} />)
    expect(screen.getByText("1 TS bez vyplněné docházky")).toBeInTheDocument()
  })

  it("says when nobody filled in attendance, in neutral Czech", () => {
    render(<TsStatsView {...base} sessions={[session("s1", { attendance: [] })]} />)
    expect(screen.getByText("Docházka zatím není vyplněná.")).toBeInTheDocument()
  })

  it("marks former members neutrally in the facilitation CSV", async () => {
    const former: StatsPerson = { id: "x", name: "Xenie Stará" }
    render(<TsStatsView {...base} sessions={[session("s1", { facilitators: [former] })]} />)
    await userEvent.click(screen.getByRole("button", { name: "Stáhnout Počet facilitací jako CSV" }))
    const [csv] = downloadCsv.mock.calls.at(-1) as [string, string]
    expect(csv).toContain("Xenie Stará · už není v týmu,1")
  })

  it("hides attendance for coaches", () => {
    render(<TsStatsView {...base} showAttendance={false} />)
    expect(screen.getByText("Docházku vidí jen členové:ky týmu.")).toBeInTheDocument()
    expect(screen.queryByText(/bez vyplněné docházky/)).not.toBeInTheDocument()
  })

  it("exports facilitation counts as CSV including members with zero", async () => {
    render(<TsStatsView {...base} />)
    await userEvent.click(screen.getByRole("button", { name: "Stáhnout Počet facilitací jako CSV" }))
    const [csv, fileName] = downloadCsv.mock.calls.at(-1) as [string, string]
    expect(fileName).toBe("ts-tym-alfa-pocet-facilitaci.csv")
    expect(csv).toContain("Adéla Malá,2")
    expect(csv).toContain("Bára Velká,0")
  })
})
