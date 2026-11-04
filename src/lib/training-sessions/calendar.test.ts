import { describe, expect, it } from "vitest"

import { buildGoogleCalendarUrl } from "./calendar"

const SESSION_URL = "https://tappka.cz/ts/session-1"

describe("buildGoogleCalendarUrl", () => {
  it("builds a prefilled Google Calendar template URL in UTC", () => {
    const url = new URL(
      buildGoogleCalendarUrl({
        topic: "Strategická session",
        startsAt: "2026-11-04T10:00:00+01:00",
        endsAt: "2026-11-04T11:30:00+01:00",
        location: "A123",
        teamName: "Alpha",
        facilitatorNames: ["Jana Nováková", "Petr Dvořák"],
        description: "Jak nastavit cíle na semestr.",
        sessionUrl: SESSION_URL,
      }),
    )

    expect(`${url.origin}${url.pathname}`).toBe("https://calendar.google.com/calendar/render")
    expect(url.searchParams.get("action")).toBe("TEMPLATE")
    expect(url.searchParams.get("text")).toBe("Strategická session")
    expect(url.searchParams.get("dates")).toBe("20261104T090000Z/20261104T103000Z")
    expect(url.searchParams.get("location")).toBe("A123")
    expect(url.searchParams.get("details")).toBe(
      "Tým: Alpha\nFacilitace: Jana Nováková, Petr Dvořák\n\nCíl:\nJak nastavit cíle na semestr.\n\nDetail TS: https://tappka.cz/ts/session-1",
    )
  })

  it("leaves out empty optional fields but keeps the backlink", () => {
    const url = new URL(
      buildGoogleCalendarUrl({
        topic: "Ranní standup",
        startsAt: "2026-11-04T08:00:00+01:00",
        endsAt: "2026-11-04T08:15:00+01:00",
        location: null,
        teamName: null,
        facilitatorNames: [],
        description: null,
        sessionUrl: SESSION_URL,
      }),
    )

    expect(url.searchParams.has("location")).toBe(false)
    expect(url.searchParams.get("details")).toBe("Detail TS: https://tappka.cz/ts/session-1")
  })

  it("encodes topic and location with special characters", () => {
    const url = new URL(
      buildGoogleCalendarUrl({
        topic: "Workshop: AI & data?",
        startsAt: "2026-11-04T10:00:00+01:00",
        endsAt: "2026-11-04T11:00:00+01:00",
        location: "Místnost č. 5 & online",
        teamName: null,
        facilitatorNames: [],
        description: null,
        sessionUrl: SESSION_URL,
      }),
    )

    expect(url.searchParams.get("text")).toBe("Workshop: AI & data?")
    expect(url.searchParams.get("location")).toBe("Místnost č. 5 & online")
  })
})
