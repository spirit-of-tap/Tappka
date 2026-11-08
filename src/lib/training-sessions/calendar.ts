const GOOGLE_CALENDAR_TEMPLATE_URL = "https://calendar.google.com/calendar/render"

export interface GoogleCalendarEvent {
  topic: string
  startsAt: string
  endsAt: string
  location: string | null
  teamName: string | null
  facilitatorNames: string[]
  description: string | null
  sessionUrl: string
}

/** Google Calendar expects compact UTC timestamps: 20261104T090000Z. */
function toGoogleCalendarDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

/** Event description shared by the "add to calendar" link and the team-calendar sync. */
export function buildEventDetails(event: Omit<GoogleCalendarEvent, "topic" | "startsAt" | "endsAt" | "location">): string {
  const lines: string[] = []
  if (event.teamName) lines.push(`Tým: ${event.teamName}`)
  if (event.facilitatorNames.length > 0) lines.push(`Facilitace: ${event.facilitatorNames.join(", ")}`)
  if (lines.length > 0) lines.push("")
  if (event.description) lines.push("Cíl:", event.description, "")
  lines.push(`Detail TS: ${event.sessionUrl}`)
  return lines.join("\n")
}

/**
 * Prefilled Google Calendar "create event" URL. Times are written in UTC,
 * so Google renders them in the viewer's own timezone without a `ctz` hint.
 */
export function buildGoogleCalendarUrl(event: GoogleCalendarEvent): string {
  const url = new URL(GOOGLE_CALENDAR_TEMPLATE_URL)
  url.searchParams.set("action", "TEMPLATE")
  url.searchParams.set("text", event.topic)
  url.searchParams.set("dates", `${toGoogleCalendarDate(event.startsAt)}/${toGoogleCalendarDate(event.endsAt)}`)
  if (event.location) url.searchParams.set("location", event.location)
  url.searchParams.set("details", buildEventDetails(event))
  return url.toString()
}
