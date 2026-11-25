import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ReservationWithDetails, Room } from "@/lib/reservations/types"

import { RoomsTimeline } from "./rooms-timeline"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => <a {...props} />,
}))

const NOW = new Date(2026, 10, 24, 14, 20)

const baseRoom = {
  description: null,
  available_days: null,
  can_have_ts: false,
  removed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  created_by_profile_id: "p1",
  updated_at: "2026-01-01T00:00:00.000Z",
  updated_by_profile_id: "p1",
}

const rooms: Room[] = [
  { ...baseRoom, id: "r2", code: "d226", name: "Horní" },
  { ...baseRoom, id: "r1", code: "d126", name: "Přední Koučovačka" },
]

const reservation = (id: string, owner: string, title: string): ReservationWithDetails => ({
  user: { id: owner, name: "Jana Nováková", picture: null },
  id,
  room_id: "r1",
  owner_profile_id: owner,
  title,
  start_at: new Date(2026, 10, 24, 9, 0).toISOString(),
  end_at: new Date(2026, 10, 24, 12, 0).toISOString(),
  cancelled_at: null,
  cancelled_by_profile_id: null,
  created_at: "2026-11-01T00:00:00.000Z",
  created_by_profile_id: owner,
  updated_at: "2026-11-01T00:00:00.000Z",
  updated_by_profile_id: owner,
  person_count: null,
})

describe("RoomsTimeline", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(NOW)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: [reservation("a", "other", "Konzultace")] }) })),
    )
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("links every room to its calendar for the shown day, ordered by floor", () => {
    render(<RoomsTimeline rooms={rooms} profileId="me" />)
    const links = screen.getAllByRole("link", { name: /^Kalendář místnosti/ })
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/reservations/d126?date=2026-11-24",
      "/reservations/d226?date=2026-11-24",
    ])
  })

  it("opens the booking dialog for the first free time from the keyboard", async () => {
    render(<RoomsTimeline rooms={rooms} profileId="me" />)
    const axis = screen.getByRole("button", { name: /Zarezervovat D126/ })
    await waitFor(() => expect(axis).toBeEnabled())
    fireEvent.click(axis, { detail: 0 })
    expect(await screen.findByRole("dialog")).toHaveTextContent("14:30")
  })

  it("shows who booked a slot instead of its title", async () => {
    const { container } = render(<RoomsTimeline rooms={rooms} profileId="me" />)
    await waitFor(() => expect(screen.getByText("JN")).toBeInTheDocument())
    expect(container.querySelector('[title^="Konzultace · Jana Nováková"]')).not.toBeNull()
  })
})
