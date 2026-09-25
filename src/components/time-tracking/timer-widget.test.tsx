import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { TimeEntryWithTag } from "@/lib/time-tracking/types"

import { TimerProvider } from "./timer-provider"
import { TimerWidget } from "./timer-widget"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const NOW = Date.parse("2026-09-24T10:00:00.000Z")
const STARTED_AT = "2026-09-24T08:29:55.000Z" // 1 h 30 min 05 s before NOW

function entry(overrides: Partial<TimeEntryWithTag> = {}): TimeEntryWithTag {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    profile_id: "00000000-0000-4000-8000-000000000002",
    direction: "reading",
    title: "Lean Startup",
    tag_id: null,
    tag: null,
    started_at: STARTED_AT,
    ended_at: null,
    duration_ms: null,
    ...overrides,
  } as TimeEntryWithTag
}

describe("TimerWidget", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows a start button when no timer runs", () => {
    render(
      <TimerProvider initialActive={null} canAccess serverNow={NOW}>
        <TimerWidget />
      </TimerProvider>,
    )
    expect(screen.getByRole("button", { name: "Spustit časomíru" })).toBeInTheDocument()
    expect(screen.queryByRole("timer")).not.toBeInTheDocument()
  })

  it("shows the live elapsed time of the running entry", () => {
    render(
      <TimerProvider initialActive={entry()} canAccess serverNow={NOW}>
        <TimerWidget />
      </TimerProvider>,
    )

    expect(screen.getByRole("timer")).toHaveTextContent("01:30:05")
    expect(screen.getByText("Lean Startup")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Zastavit časomíru" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Otevřít Čas" })).toHaveAttribute("href", "/cas")

    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(screen.getByRole("timer")).toHaveTextContent("01:30:07")
  })

  it("falls back to the direction label when the entry has no title", () => {
    render(
      <TimerProvider initialActive={entry({ title: null, direction: "practise" })} canAccess serverNow={NOW}>
        <TimerWidget />
      </TimerProvider>,
    )
    expect(screen.getByText("Practise")).toBeInTheDocument()
  })

  it("renders only an icon button in the collapsed sidebar", async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    render(
      <TimerProvider initialActive={null} canAccess>
        <TimerWidget collapsed />
      </TimerProvider>,
    )
    const button = screen.getByRole("button", { name: "Spustit časomíru" })
    expect(button).not.toHaveTextContent("Spustit časomíru")
    await user.hover(button)
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Spustit časomíru")
  })
})
