import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getSlotChips } from "@/lib/reservations/room-map"
import type { Room } from "@/lib/reservations/types"

import { RoomDetailPanel } from "./room-detail-panel"

vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => <a {...props} />,
}))

const ROOM: Room = {
  id: "r1",
  code: "d126",
  name: "D126",
  description: null,
  available_days: null,
  can_have_ts: false,
  removed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  created_by_profile_id: "p1",
  updated_at: "2026-01-01T00:00:00.000Z",
  updated_by_profile_id: "p1",
}

function renderAt(now: Date, duration: number) {
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  render(
    <RoomDetailPanel
      room={ROOM}
      status={{ kind: "free", until: null, reservationCount: 0 }}
      isToday
      isLoading={false}
      chips={getSlotChips(day, [], duration, now)}
      day={day}
      reservations={[]}
      duration={duration}
      chosenStart={null}
      onChooseStart={vi.fn()}
      onChooseDuration={vi.fn()}
      onBook={vi.fn()}
    />,
  )
}

describe("RoomDetailPanel late in the day", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }))
  afterEach(() => vi.useRealTimers())

  it("explains why no start time is left instead of an empty grid", () => {
    const now = new Date(2026, 10, 24, 21, 30)
    vi.setSystemTime(now)
    renderAt(now, 60)
    expect(screen.getByText(/Dnes už se nedá začít/)).toBeInTheDocument()
  })

  it("still offers start times earlier in the evening", () => {
    const now = new Date(2026, 10, 24, 20, 0)
    vi.setSystemTime(now)
    renderAt(now, 60)
    expect(screen.queryByText(/Dnes už se nedá začít/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "21:00" })).toBeInTheDocument()
  })
})
