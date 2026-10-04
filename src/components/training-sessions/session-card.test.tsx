import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { TrainingSessionListItem } from "@/lib/training-sessions/types"

import { SessionCard } from "./session-card"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

const session: TrainingSessionListItem = {
  id: "s1",
  team_id: "t1",
  topic: "AI v projektech",
  description: null,
  starts_at: "2026-10-06T06:00:00.000Z",
  ends_at: "2026-10-06T10:00:00.000Z",
  room_id: "r1",
  location_note: null,
  guest_capacity: 3,
  cancelled_at: null,
  team: { id: "t1", name: "Tuuli", color: null, onboardingYear: 2 },
  room: { id: "r1", code: "E209", name: "E209" },
  facilitators: [{ profile: { id: "p1", name: "Anna", picture: null } }],
  guests: [{ profile_id: "g1", joined_at: "2026-10-01T00:00:00Z", profile: { id: "g1", name: "Klára", picture: null } }],
  preparation: null,
}
const now = "2026-10-02T08:00:00.000Z"

describe("SessionCard", () => {
  it("shows own-team badge and no join button for own team", () => {
    render(<SessionCard session={session} viewer={{ profileId: "p1", teamId: "t1" }} conflicts={[]} now={now} />)
    expect(screen.getByText("Můj tým")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Přihlásit se/ })).not.toBeInTheDocument()
  })

  it("shows occupancy and a join button for other teams", () => {
    render(<SessionCard session={session} viewer={{ profileId: "x", teamId: "t2" }} conflicts={[]} now={now} />)
    expect(screen.getByText("1/3 míst")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Přihlásit se/ })).toBeInTheDocument()
  })

  it("shows full state when capacity is reached", () => {
    render(<SessionCard session={{ ...session, guest_capacity: 1 }} viewer={{ profileId: "x", teamId: "t2" }} conflicts={[]} now={now} />)
    expect(screen.getByText("Obsazeno")).toBeInTheDocument()
  })

  it("shows the overlap warning", () => {
    const conflict = {
      commitment: { id: "m", startsAt: "2026-10-06T06:00:00.000Z", endsAt: "2026-10-06T08:00:00.000Z", cancelledAt: null },
      overlapStart: "2026-10-06T06:00:00.000Z",
      overlapEnd: "2026-10-06T08:00:00.000Z",
    }
    render(<SessionCard session={session} viewer={{ profileId: "x", teamId: "t2" }} conflicts={[conflict]} now={now} />)
    expect(screen.getByText("Kryje se s tvým TS · 8:00–10:00")).toBeInTheDocument()
  })

  it("mutes a cancelled session and hides guest controls", () => {
    render(<SessionCard session={{ ...session, cancelled_at: now }} viewer={{ profileId: "x", teamId: "t2" }} conflicts={[]} now={now} />)
    expect(screen.getByText("Zrušeno")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Přihlásit se/ })).not.toBeInTheDocument()
  })

  it("hides guest controls when closed to guests", () => {
    render(<SessionCard session={{ ...session, guest_capacity: 0, guests: [] }} viewer={{ profileId: "x", teamId: "t2" }} conflicts={[]} now={now} />)
    expect(screen.queryByRole("button", { name: /Přihlásit se/ })).not.toBeInTheDocument()
  })

  it("shows facilitators and crosses by name", () => {
    render(<SessionCard session={session} viewer={{ profileId: "x", teamId: "t2" }} conflicts={[]} now={now} />)
    expect(screen.getByText("Facilitace")).toBeInTheDocument()
    expect(screen.getByText("Anna")).toBeInTheDocument()
    expect(screen.getByText("Crossy")).toBeInTheDocument()
    expect(screen.getByText("Klára")).toBeInTheDocument()
  })

  it("hides the room when location is turned off", () => {
    const { rerender } = render(<SessionCard session={session} viewer={{ profileId: "x", teamId: "t2" }} conflicts={[]} now={now} />)
    expect(screen.getByText("E209")).toBeInTheDocument()
    rerender(<SessionCard session={session} viewer={{ profileId: "x", teamId: "t2" }} conflicts={[]} now={now} showLocation={false} />)
    expect(screen.queryByText("E209")).not.toBeInTheDocument()
  })

  it("shows whether the preparation is ready", () => {
    const { rerender } = render(<SessionCard session={session} viewer={{ profileId: "p1", teamId: "t1" }} conflicts={[]} now={now} />)
    expect(screen.getByText("Příprava zatím chybí")).toBeInTheDocument()
    rerender(
      <SessionCard
        session={{ ...session, preparation: { published_at: now } }}
        viewer={{ profileId: "p1", teamId: "t1" }}
        conflicts={[]}
        now={now}
      />,
    )
    expect(screen.getByText("Příprava je připravená")).toBeInTheDocument()
  })

  it("marks the card with the team color", () => {
    const { container } = render(
      <SessionCard
        session={{ ...session, team: { id: "t1", name: "Tuuli", color: "#ff0000", onboardingYear: 2 } }}
        viewer={{ profileId: "x", teamId: "t2" }}
        conflicts={[]}
        now={now}
      />,
    )
    expect(container.querySelector("article")?.getAttribute("style")).toContain("color-mix")
  })
})
