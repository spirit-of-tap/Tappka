import { render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import type { RoomWithStatus } from "@/lib/reservations/types"

import { RoomCard } from "./room-card"
import type { FilterState } from "./room-filter"

vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => <a {...props} />,
}))

const activeReservation: RoomWithStatus["currentReservation"] = {
  id: "res-1",
  room_id: "r1",
  owner_profile_id: "p1",
  title: "solo deepwork",
  person_count: 1,
  start_at: "2026-11-02T15:00:00.000Z",
  end_at: "2026-11-02T16:00:00.000Z",
  cancelled_at: null,
  cancelled_by_profile_id: null,
  created_at: "2026-11-02T08:00:00.000Z",
  created_by_profile_id: "p1",
  updated_at: "2026-11-02T08:00:00.000Z",
  updated_by_profile_id: "p1",
}

// Snapshot the page rendered before 17:00: the room is still marked occupied
// even though it is free by the time the user filters for.
const room: RoomWithStatus = {
  id: "r1",
  code: "d127",
  name: "D127 – Tichá místnost",
  description: null,
  available_days: null,
  can_have_ts: false,
  removed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  created_by_profile_id: "p1",
  updated_at: "2026-01-01T00:00:00.000Z",
  updated_by_profile_id: "p1",
  currentReservation: activeReservation,
  nextAvailableTime: new Date(2026, 10, 2, 17, 0),
}

const filterState: FilterState = {
  date: new Date(2026, 10, 2),
  startTime: "17:45",
  duration: "90",
}

describe("RoomCard", () => {
  it("shows the filtered window as free instead of the stale live status", () => {
    render(<RoomCard room={room} filterState={filterState} />)

    expect(screen.getByText("Volná")).toBeInTheDocument()
    expect(screen.queryByText("Obsazeno")).not.toBeInTheDocument()
    expect(screen.getByText("Volná 17:45–19:15")).toBeInTheDocument()
    expect(screen.queryByText("Volná od 17:00")).not.toBeInTheDocument()
    expect(screen.queryByText("solo deepwork")).not.toBeInTheDocument()
  })

  it("marks a room with a conflict in the filtered window as occupied", () => {
    render(
      <RoomCard
        room={{
          ...room,
          availabilityForFilter: {
            isAvailable: false,
            reason: "occupied",
            conflictTime: "16:00-18:00",
            conflictTitle: "TS - Pika",
          },
        }}
        filterState={filterState}
      />,
    )

    expect(screen.getByText("Obsazeno")).toBeInTheDocument()
    expect(screen.getByText("Obsazeno 16:00-18:00 – TS - Pika")).toBeInTheDocument()
    expect(screen.queryByText(/^Volná/)).not.toBeInTheDocument()
  })

  it("marks a room closed for the filtered day as unavailable", () => {
    render(
      <RoomCard
        room={{
          ...room,
          availabilityForFilter: { isAvailable: false, reason: "day_restricted" },
        }}
        filterState={filterState}
      />,
    )

    expect(screen.getByText("Nedostupná")).toBeInTheDocument()
    expect(screen.getByText("Nedostupná v tento den")).toBeInTheDocument()
    expect(screen.queryByText(/^Volná/)).not.toBeInTheDocument()
  })

  it("keeps the live status when no filter is active", () => {
    render(<RoomCard room={room} />)

    expect(screen.getByText("Obsazeno")).toBeInTheDocument()
    expect(screen.getByText("solo deepwork")).toBeInTheDocument()
    expect(screen.getByText("Volná od 17:00")).toBeInTheDocument()
  })
})
