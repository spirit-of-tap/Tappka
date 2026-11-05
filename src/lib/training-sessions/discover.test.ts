import { describe, expect, it } from "vitest"

import { matchesDiscoverFilter, sessionStudyYear } from "./discover"
import type { TrainingSessionListItem } from "./types"

const NOW = "2026-11-05T09:00:00.000Z"

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
    team: { id: "t1", name: "Tuuli", color: null, onboardingYear: 2025 },
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
    expect(matchesDiscoverFilter(session(), "nadchazejici", null, viewer, NOW)).toBe(true)
  })

  it("filters by the team's study year in the session's school year", () => {
    const thirdYear = session({
      team: { id: "t1", name: "PAVIAAN", color: null, onboardingYear: 2024 },
    })

    expect(matchesDiscoverFilter(thirdYear, "nadchazejici", 3, viewer, NOW)).toBe(true)
    expect(matchesDiscoverFilter(thirdYear, "nadchazejici", 2, viewer, NOW)).toBe(false)
  })

  it("respects the academic year boundary", () => {
    const winterSession = session({ starts_at: "2026-01-05T07:00:00.000Z" })
    const autumnSession = session({ starts_at: "2026-10-05T07:00:00.000Z" })

    expect(sessionStudyYear(winterSession.starts_at, 2025, NOW)).toBe(1)
    expect(sessionStudyYear(autumnSession.starts_at, 2025, NOW)).toBe(2)
  })

  it("falls back to the current cohort when onboardingYear is missing", () => {
    const unknownCohort = session({
      team: { id: "t1", name: "Tuuli", color: null, onboardingYear: null },
    })

    expect(matchesDiscoverFilter(unknownCohort, "nadchazejici", 1, viewer, NOW)).toBe(true)
    expect(matchesDiscoverFilter(unknownCohort, "nadchazejici", 2, viewer, NOW)).toBe(false)
  })

  it("does not match teams outside the three-year program", () => {
    const alumni = session({
      team: { id: "t1", name: "InviTAP", color: null, onboardingYear: 2019 },
    })

    expect(sessionStudyYear(alumni.starts_at, alumni.team?.onboardingYear, NOW)).toBeNull()
    expect(matchesDiscoverFilter(alumni, "nadchazejici", 1, viewer, NOW)).toBe(false)
  })

  it("only keeps other teams' sessions with a free spot", () => {
    const free = session({ team_id: "t2", guests: [] })
    expect(matchesDiscoverFilter(free, "volna-mista", null, viewer, NOW)).toBe(true)

    expect(matchesDiscoverFilter(session({ guests: [] }), "volna-mista", null, viewer, NOW)).toBe(false)
    expect(
      matchesDiscoverFilter(
        session({ team_id: "t2", cancelled_at: "2026-11-01T00:00:00Z" }),
        "volna-mista",
        null,
        viewer,
        NOW,
      ),
    ).toBe(false)
  })

  it("treats a full session as unavailable", () => {
    const full = session({
      team_id: "t2",
      guest_capacity: 1,
      guests: [{ profile_id: "g1", joined_at: "2026-11-01T00:00:00Z", profile: null }],
    })
    expect(matchesDiscoverFilter(full, "volna-mista", null, viewer, NOW)).toBe(false)
  })
})
