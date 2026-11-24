import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { MS_PER_HOUR } from "@/lib/time-tracking/constants"
import type { DayBreakdown } from "@/lib/time-tracking/day-breakdown"
import type { TimeDirection } from "@/lib/time-tracking/types"

import { WeekHero } from "./week-hero"

function byDirection(overrides: Partial<Record<TimeDirection, number>> = {}): Record<TimeDirection, number> {
  return { training: 0, reading: 0, practise: 0, project: 0, ...overrides }
}

const DAYS: DayBreakdown[] = [
  {
    dateKey: "2026-09-21",
    totalMs: 4.5 * MS_PER_HOUR,
    byDirection: byDirection({ training: 1.5 * MS_PER_HOUR, practise: 3 * MS_PER_HOUR }),
  },
  { dateKey: "2026-09-22", totalMs: 0, byDirection: byDirection() },
]

function renderHero(props: Partial<React.ComponentProps<typeof WeekHero>> = {}) {
  return render(
    <WeekHero
      current={16.5}
      target={40}
      label="Tento týden"
      rangeLabel="21.–27. 9. 2026"
      byDirection={byDirection({ training: 4 * MS_PER_HOUR, practise: 10 * MS_PER_HOUR })}
      days={DAYS}
      todayKey="2026-09-22"
      timerElapsedMs={null}
      {...props}
    />,
  )
}

describe("WeekHero", () => {
  it("shows the remaining hours, the period and the top direction", () => {
    renderHero()

    expect(screen.getByText("Tento týden · 21.–27. 9. 2026")).toBeInTheDocument()
    expect(screen.getByText(/Zbývá 23,5\s*h/)).toBeInTheDocument()
    expect(screen.getByText("Nejvíc dáváš do směru Practise.")).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Tento týden" })).toHaveAttribute("aria-valuenow", "16.5")
  })

  it("says the goal is met instead of the remaining time", () => {
    renderHero({ current: 42, target: 40 })

    expect(screen.getByText(/Cíl splněn/)).toBeInTheDocument()
    expect(screen.queryByText(/Zbývá/)).not.toBeInTheDocument()
  })

  it("omits the insight for an empty week", () => {
    renderHero({ current: 0, byDirection: byDirection() })

    expect(screen.queryByText(/Nejvíc dáváš/)).not.toBeInTheDocument()
    expect(screen.getByText(/Zbývá 40\s*h/)).toBeInTheDocument()
  })

  it("starts a timer when none runs", async () => {
    const onStartTimer = vi.fn()
    const user = userEvent.setup()
    renderHero({ onStartTimer, onStopTimer: vi.fn() })

    await user.click(screen.getByRole("button", { name: "Spustit stopky" }))

    expect(onStartTimer).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("button", { name: "Zastavit" })).not.toBeInTheDocument()
  })

  it("shows the elapsed time and stops a running timer", async () => {
    const onStopTimer = vi.fn()
    const user = userEvent.setup()
    renderHero({ timerElapsedMs: 5_025_000, onStartTimer: vi.fn(), onStopTimer })

    expect(screen.getByRole("timer")).toHaveTextContent("01:23:45")
    expect(screen.queryByRole("button", { name: "Spustit stopky" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Zastavit" }))

    expect(onStopTimer).toHaveBeenCalledTimes(1)
  })

  it("hides the timer action without handlers", () => {
    renderHero()

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("gives the chart a text alternative per day", () => {
    renderHero()

    const list = screen.getByRole("list", { name: "Čas po dnech" })
    const items = within(list).getAllByRole("listitem").map((item) => item.textContent?.replaceAll("\u00a0", " "))
    expect(items[0]).toBe("Pondělí 21. 9. 4,5 h: Training 1,5 h, Practise 3 h")
    expect(items[1]).toBe("Úterý 22. 9. 0 h")
  })

  it("hides the chart for long ranges", () => {
    renderHero({ days: null })

    expect(screen.queryByRole("list", { name: "Čas po dnech" })).not.toBeInTheDocument()
  })
})
