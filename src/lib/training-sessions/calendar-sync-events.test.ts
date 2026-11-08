import { describe, expect, it } from "vitest"

import { GoogleCalendarError } from "@/lib/google-calendar/client"

import { buildTeamCalendarEvent, calendarEventId, canManageTeamCalendar, canRobotWrite, describeCalendarError, isValidCalendarId } from "./calendar-sync-events"

const SESSION = {
  id: "0b6c1e2a-4f1d-4c3a-9d7e-1a2b3c4d5e6f",
  topic: "Vyjednávání",
  description: "Naučit se BATNA",
  starts_at: "2026-11-10T08:00:00+00:00",
  ends_at: "2026-11-10T11:00:00+00:00",
  location_note: null,
  room: { code: "C2" },
  team: { name: "Alfa" },
  facilitatorNames: ["Ema", "Ota"],
  preparationPublished: false,
}

describe("calendarEventId", () => {
  it("is the session UUID without dashes — valid base32hex, stable per session", () => {
    const id = calendarEventId(SESSION.id)
    expect(id).toBe("0b6c1e2a4f1d4c3a9d7e1a2b3c4d5e6f")
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/)
  })
})

describe("buildTeamCalendarEvent", () => {
  it("maps the session to a Prague-time event with room, facilitators and a link back", () => {
    const event = buildTeamCalendarEvent(SESSION, "https://tappka.cz")
    expect(event).toMatchObject({
      summary: "TS: Vyjednávání",
      location: "C2",
      start: { dateTime: SESSION.starts_at, timeZone: "Europe/Prague" },
      end: { dateTime: SESSION.ends_at, timeZone: "Europe/Prague" },
      source: { title: "Tappka", url: `https://tappka.cz/ts/${SESSION.id}` },
    })
    expect(event.description).toContain("Facilitace: Ema, Ota")
    expect(event.description).toContain("Naučit se BATNA")
  })

  it("marks a published preparation with ✅ in the title and says so in the description", () => {
    const event = buildTeamCalendarEvent({ ...SESSION, preparationPublished: true }, "https://tappka.cz")
    expect(event.summary).toBe("✅ TS: Vyjednávání")
    expect(event.description?.split("\n")[0]).toBe("✅ Příprava je zveřejněná, najdeš ji v detailu TS.")
    expect(buildTeamCalendarEvent(SESSION, "https://tappka.cz").description).not.toContain("Příprava")
  })

  it("falls back to the location note and omits an empty location", () => {
    expect(buildTeamCalendarEvent({ ...SESSION, room: null, location_note: "Online" }, "https://x").location).toBe("Online")
    expect(buildTeamCalendarEvent({ ...SESSION, room: null }, "https://x")).not.toHaveProperty("location")
  })
})

describe("describeCalendarError", () => {
  it("explains missing sharing, missing edit permission and outages in Czech", () => {
    expect(describeCalendarError(new GoogleCalendarError(404, "Not Found"))).toMatch(/sdílený/)
    expect(describeCalendarError(new GoogleCalendarError(403, "Forbidden"))).toMatch(/Provádět změny/)
    expect(describeCalendarError(new GoogleCalendarError(503, "x"))).toMatch(/nedostupný/)
    expect(describeCalendarError(new Error("boom"))).toMatch(/nedostupný/)
  })
})

describe("isValidCalendarId", () => {
  it("accepts e-mail-like calendar IDs and rejects junk", () => {
    expect(isValidCalendarId("abc123@group.calendar.google.com")).toBe(true)
    expect(isValidCalendarId("tym@tiimiakatemia.cz")).toBe(true)
    expect(isValidCalendarId("https://calendar.google.com/x")).toBe(false)
    expect(isValidCalendarId("")).toBe(false)
  })
})

describe("canManageTeamCalendar", () => {
  it("lets members manage their own team and coaches/admins any team", () => {
    expect(canManageTeamCalendar({ role: "student", teamId: "t1" }, "t1")).toBe(true)
    expect(canManageTeamCalendar({ role: "student", teamId: "t1" }, "t2")).toBe(false)
    expect(canManageTeamCalendar({ role: "student", teamId: null }, "t2")).toBe(false)
    expect(canManageTeamCalendar({ role: "coach", teamId: null }, "t2")).toBe(true)
    expect(canManageTeamCalendar({ role: "admin", teamId: "t1" }, "t2")).toBe(true)
  })
})

describe("canRobotWrite", () => {
  it("requires event-changing permission", () => {
    expect(canRobotWrite("writer")).toBe(true)
    expect(canRobotWrite("owner")).toBe(true)
    expect(canRobotWrite("reader")).toBe(false)
    expect(canRobotWrite("freeBusyReader")).toBe(false)
  })
})
