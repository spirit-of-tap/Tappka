import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { TrainingSessionListItem } from "@/lib/training-sessions/types"

import { SessionAgenda } from "./session-agenda"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

const session: TrainingSessionListItem = {
  id: "s1",
  team_id: "t1",
  topic: "AI v projektech",
  description: null,
  starts_at: "2026-11-24T09:00:00.000Z",
  ends_at: "2026-11-24T11:00:00.000Z",
  room_id: null,
  location_note: null,
  guest_capacity: 0,
  cancelled_at: null,
  team: { id: "t1", name: "Tuuli", color: null, onboardingYear: 2 },
  room: null,
  facilitators: [],
  guests: [],
  preparation: null,
}

describe("SessionAgenda", () => {
  it("renders a sentence-case day heading with a relative hint", () => {
    render(
      <SessionAgenda
        sessions={[session, { ...session, id: "s2", starts_at: "2026-11-27T09:00:00.000Z", ends_at: "2026-11-27T11:00:00.000Z" }]}
        viewer={{ profileId: "p1", teamId: "t1" }}
        commitments={[]}
        now="2026-11-24T08:00:00.000Z"
        emptyTitle="Nic"
        emptyDescription=""
      />,
    )
    expect(screen.getByRole("heading", { level: 3, name: "Úterý 24. listopadu" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 3, name: "Pátek 27. listopadu" })).toBeInTheDocument()
    expect(screen.getByText("Dnes")).toBeInTheDocument()
    expect(screen.getByText("za 3 dny")).toBeInTheDocument()
  })
})
