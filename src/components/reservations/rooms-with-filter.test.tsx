import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Reservation, RoomWithStatus } from "@/lib/reservations/types"

import { RoomsWithFilter } from "./rooms-with-filter"

vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => <a {...props} />,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

const NOW = new Date(2026, 10, 23, 9, 0, 0, 0)

const baseRoom = {
  description: null,
  available_days: null,
  can_have_ts: false,
  removed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  created_by_profile_id: "p1",
  updated_at: "2026-01-01T00:00:00.000Z",
  updated_by_profile_id: "p1",
  currentReservation: null,
  nextAvailableTime: null,
}

const busyRoom: RoomWithStatus = { ...baseRoom, id: "r1", code: "d126", name: "D126 – Velká" }
const freeRoom: RoomWithStatus = {
  ...baseRoom,
  id: "r2",
  code: "d226",
  name: "D226 – Horní",
  can_have_ts: true,
}
const closedRoom: RoomWithStatus = {
  ...baseRoom,
  id: "r3",
  code: "d107",
  name: "D107 – Zavřená",
  available_days: [0],
}

const reservation = (overrides: Partial<Reservation>): Reservation => ({
  id: "res-1",
  room_id: "r1",
  owner_profile_id: "p1",
  title: "TS",
  person_count: 1,
  start_at: new Date(2026, 10, 23, 8, 30).toISOString(),
  end_at: new Date(2026, 10, 23, 10, 30).toISOString(),
  cancelled_at: null,
  cancelled_by_profile_id: null,
  created_at: "2026-11-01T00:00:00.000Z",
  created_by_profile_id: "p1",
  updated_at: "2026-11-01T00:00:00.000Z",
  updated_by_profile_id: "p1",
  ...overrides,
})

describe("RoomsWithFilter", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const renderMap = (myReservations: Reservation[] = []) =>
    render(
      <RoomsWithFilter
        rooms={[busyRoom, freeRoom, closedRoom]}
        reservations={[reservation({})]}
        myReservations={myReservations}
      />,
    )

  it("groups rooms by floor and shows tile statuses", () => {
    renderMap()

    expect(screen.getByRole("region", { name: "1. patro" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "2. patro" })).toBeInTheDocument()
    expect(screen.getByText("Obsazená do 10:30")).toBeInTheDocument()
    expect(screen.getByText("Dnes zavřeno")).toBeInTheDocument()
  })

  it("selects the first free room by default", () => {
    renderMap()

    const panel = screen.getByRole("region", { name: "Detail místnosti" })
    expect(within(panel).getByRole("heading", { name: "D226" })).toBeInTheDocument()
    expect(within(panel).getByText("TS místnost")).toBeInTheDocument()
  })

  it("shows the clicked room in the detail panel", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderMap()

    await user.click(screen.getByRole("button", { name: /D126/ }))

    const panel = screen.getByRole("region", { name: "Detail místnosti" })
    expect(within(panel).getByRole("heading", { name: "D126" })).toBeInTheDocument()
    expect(within(panel).getByText("Obsazená")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /D126/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("marks a room where the user has a reservation", () => {
    renderMap([
      reservation({
        id: "mine",
        room_id: "r2",
        start_at: new Date(2026, 10, 23, 14, 0).toISOString(),
        end_at: new Date(2026, 10, 23, 15, 0).toISOString(),
      }),
    ])

    expect(screen.getByText("Tvoje · 14:00")).toBeInTheDocument()
  })

  it("offers the first free slot and a closed room has no booking", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderMap()

    const panel = screen.getByRole("region", { name: "Detail místnosti" })
    expect(within(panel).getByRole("button", { name: "Rezervovat 09:00–10:00" })).toBeEnabled()

    await user.click(screen.getByRole("button", { name: /D107/ }))
    expect(within(panel).getByText("Místnost je v tento den zavřená")).toBeInTheDocument()
    expect(within(panel).getByRole("button", { name: "Rezervovat" })).toBeDisabled()
  })

  it("applies the chosen duration to the booking button", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderMap()

    const panel = screen.getByRole("region", { name: "Detail místnosti" })
    await user.click(within(panel).getByRole("button", { name: "2 h" }))

    expect(within(panel).getByRole("button", { name: "Rezervovat 09:00–11:00" })).toBeInTheDocument()
  })
})
