import { describe, expect, it } from "vitest"

import {
  formatConflict,
  formatDayHeading,
  formatPeopleList,
  formatTimeRange,
  groupByPragueDay,
  pragueDateKey,
  teamAccentStyles,
  toTimeInputValue,
} from "./format"

describe("Prague formatting", () => {
  it("keys by Prague date, not UTC date", () => {
    expect(pragueDateKey("2026-10-06T22:30:00Z")).toBe("2026-10-07")
  })
  it("formats a capitalized day heading", () => {
    expect(formatDayHeading("2026-10-06T06:00:00Z")).toBe("Úterý 6. října")
  })
  it("formats a time range in CEST and CET", () => {
    expect(formatTimeRange("2026-10-06T06:00:00Z", "2026-10-06T10:00:00Z")).toBe("8:00–12:00")
    expect(formatTimeRange("2026-10-27T07:00:00Z", "2026-10-27T11:00:00Z")).toBe("8:00–12:00")
  })
  it("formats a zero-padded value for time inputs", () => {
    expect(toTimeInputValue("2026-10-06T06:00:00Z")).toBe("08:00")
    expect(toTimeInputValue("2026-10-06T11:30:00Z")).toBe("13:30")
  })
  it("groups items by Prague day in input order", () => {
    const items = [
      { id: 1, s: "2026-10-06T06:00:00Z" },
      { id: 2, s: "2026-10-06T11:00:00Z" },
      { id: 3, s: "2026-10-07T06:00:00Z" },
    ]
    const groups = groupByPragueDay(items, (i) => i.s)
    expect(groups.map((g) => [g.dateKey, g.items.map((i) => i.id)])).toEqual([
      ["2026-10-06", [1, 2]],
      ["2026-10-07", [3]],
    ])
  })
})

describe("formatConflict", () => {
  const session = { id: "s", startsAt: "2026-10-06T06:00:00Z", endsAt: "2026-10-06T10:00:00Z", cancelledAt: null }
  const commitment = { id: "c", startsAt: "2026-10-06T06:00:00Z", endsAt: "2026-10-06T08:00:00Z", cancelledAt: null }

  it("skips the time when the whole session overlaps", () => {
    const conflict = { commitment, overlapStart: session.startsAt, overlapEnd: session.endsAt }
    expect(formatConflict(session, conflict)).toBe("souběh s tvým TS")
  })
  it("names only the late start when the conflict starts inside the session", () => {
    const conflict = { commitment, overlapStart: "2026-10-06T08:00:00Z", overlapEnd: session.endsAt }
    expect(formatConflict(session, conflict)).toBe("souběh s tvým TS od 10:00")
  })
  it("names only the early end when the conflict ends inside the session", () => {
    const conflict = { commitment, overlapStart: session.startsAt, overlapEnd: "2026-10-06T08:00:00Z" }
    expect(formatConflict(session, conflict)).toBe("souběh s tvým TS do 10:00")
  })
  it("shows the inner range when the conflict sits inside the session", () => {
    const conflict = { commitment, overlapStart: "2026-10-06T08:00:00Z", overlapEnd: "2026-10-06T09:00:00Z" }
    expect(formatConflict(session, conflict)).toBe("souběh s tvým TS · 10:00–11:00")
  })
  it("uses a sentence for the detail banner and the join dialog", () => {
    const full = { commitment, overlapStart: session.startsAt, overlapEnd: session.endsAt }
    const partial = { commitment, overlapStart: "2026-10-06T08:00:00Z", overlapEnd: session.endsAt }
    expect(formatConflict(session, full, "sentence")).toBe("Kryje se s tvým TS")
    expect(formatConflict(session, partial, "sentence")).toBe("Kryje se s tvým TS · 10:00–12:00")
  })
})

describe("formatPeopleList", () => {
  it("lists everyone up to the preview count", () => {
    expect(formatPeopleList(["Anna", "Petr"])).toBe("Anna, Petr")
    expect(formatPeopleList([])).toBe("")
  })
  it("collapses the rest into +N", () => {
    expect(formatPeopleList(["Anna", "Petr", "Klára", "Ema", "Jan"])).toBe("Anna, Petr, Klára +2")
    expect(formatPeopleList(["Anna", "Petr"], 1)).toBe("Anna +1")
  })
})

describe("teamAccentStyles", () => {
  it("returns no styles without a team color", () => {
    expect(teamAccentStyles(null)).toEqual({ stripe: undefined, surface: undefined })
  })
  it("uses the full color for the stripe and a faint tint for the surface", () => {
    const styles = teamAccentStyles("#ff0000")
    expect(styles.stripe).toEqual({ backgroundColor: "#ff0000" })
    expect(styles.surface?.backgroundImage).toContain("color-mix(in oklab, #ff0000 7%, transparent)")
  })
})
