import { describe, expect, it } from "vitest"

import { matchesDiscoverFilter } from "./discover"
import type { TrainingSessionListItem } from "./types"

function session(overrides: Partial<TrainingSessionListItem> = {}): TrainingSessionListItem {
  return {
    id: "s1",
    team_id: "t1",
    topic: "Příprava",
    description: null,
    starts_at: "2026-11-10T06:00:00.000Z",
    ends_at: "2026-11-10T08:00:00.000Z",
    room_id: null,
    location_note: null,
    guest_capacity: 3,
    cancelled_at: null,
    team: { id: "t1", name: "Tuuli", color: null, onboardingYear: 2 },
    room: null,
    facilitators: [],
    guests: [],
    preparation: null,
    ...overrides,
  }
}

const viewer = { profileId: "p1", teamId: "t1" }

describe("matchesDiscoverFilter", () => {
  it("lets upcoming sessions through", () => {
    expect(matchesDiscoverFilter(session(), "nadchazejici", null, viewer)).toBe(true)
  })

  it("filters by onboarding year", () => {
    expect(matchesDiscoverFilter(session(), "nadchazejici", 1, viewer)).toBe(false)
    expect(matchesDiscoverFilter(session(), "nadchazejici", 2, viewer)).toBe(true)
  })

  it("only keeps other teams' sessions with a free spot", () => {
    const free = session({ team_id: "t2", guests: [] })
    expect(matchesDiscoverFilter(free, "volna-mista", null, viewer)).toBe(true)

    expect(matchesDiscoverFilter(session({ guests: [] }), "volna-mista", null, viewer)).toBe(false)
    expect(matchesDiscoverFilter(session({ team_id: "t2", cancelled_at: "2026-11-01T00:00:00Z" }), "volna-mista", null, viewer)).toBe(false)
  })

  it("treats a full session as unavailable", () => {
    const full = session({
      team_id: "t2",
      guest_capacity: 1,
      guests: [{ profile_id: "g1", joined_at: "2026-11-01T00:00:00Z", profile: null }],
    })
    expect(matchesDiscoverFilter(full, "volna-mista", null, viewer)).toBe(false)
  })
})
