/** Pure pieces of the team Google Calendar sync: event ids, event content, error copy. */
import { GoogleCalendarError, type CalendarEventBody } from "@/lib/google-calendar/client"

import { buildEventDetails } from "./calendar"
import { PRAGUE_TIME_ZONE, TS_ROUTES } from "./constants"

const EVENT_SUMMARY_PREFIX = "TS: "
const EVENT_SOURCE_TITLE = "Tappka"
const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403
const HTTP_NOT_FOUND = 404
/** Calendar IDs look like e-mails: `…@group.calendar.google.com` or a person's/resource address. */
const CALENDAR_ID_PATTERN = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/

export const CALENDAR_ERRORS = {
  notShared: "Kalendář se nepodařilo najít. Zkontroluj ID kalendáře a jestli je sdílený s robotem Tappky.",
  readOnly: "Robot Tappky nemá oprávnění „Provádět změny událostí“. Uprav sdílení kalendáře.",
  signIn: "Robot účet Tappky se nepodařilo přihlásit. Ozvi se správě Tappky.",
  unavailable: "Google Kalendář je teď nedostupný. Zkus to prosím znovu.",
} as const

export interface SyncableSession {
  id: string
  topic: string
  description: string | null
  starts_at: string
  ends_at: string
  location_note: string | null
  room: { code: string } | null
  team: { name: string } | null
  facilitatorNames: string[]
}

/** Deterministic Google event id: a dash-less UUID is valid base32hex, so retries never duplicate. */
export function calendarEventId(sessionId: string): string {
  return sessionId.replaceAll("-", "").toLowerCase()
}

export function buildTeamCalendarEvent(session: SyncableSession, appOrigin: string): CalendarEventBody {
  const sessionUrl = `${appOrigin}${TS_ROUTES.detail(session.id)}`
  const location = session.room?.code ?? session.location_note
  return {
    summary: `${EVENT_SUMMARY_PREFIX}${session.topic}`,
    description: buildEventDetails({
      teamName: session.team?.name ?? null,
      facilitatorNames: session.facilitatorNames,
      description: session.description,
      sessionUrl,
    }),
    ...(location ? { location } : {}),
    start: { dateTime: session.starts_at, timeZone: PRAGUE_TIME_ZONE },
    end: { dateTime: session.ends_at, timeZone: PRAGUE_TIME_ZONE },
    source: { title: EVENT_SOURCE_TITLE, url: sessionUrl },
  }
}

/** User-facing Czech explanation of a failed Google call. */
export function describeCalendarError(error: unknown): string {
  if (!(error instanceof GoogleCalendarError)) return CALENDAR_ERRORS.unavailable
  if (error.status === HTTP_NOT_FOUND) return CALENDAR_ERRORS.notShared
  if (error.status === HTTP_FORBIDDEN) return CALENDAR_ERRORS.readOnly
  if (error.status === HTTP_UNAUTHORIZED) return CALENDAR_ERRORS.signIn
  return CALENDAR_ERRORS.unavailable
}

export function isValidCalendarId(value: string): boolean {
  return CALENDAR_ID_PATTERN.test(value.trim())
}

/** Roles that may manage any team's calendar; everyone else only their own team's. */
export const CALENDAR_ADMIN_ROLES: readonly string[] = ["coach", "admin"]
const WRITABLE_ACCESS_ROLES: readonly string[] = ["writer", "owner"]

export function canManageTeamCalendar(viewer: { role: string; teamId: string | null }, teamId: string): boolean {
  return CALENDAR_ADMIN_ROLES.includes(viewer.role) || viewer.teamId === teamId
}

/** The robot must be able to change events, not just see them. */
export function canRobotWrite(accessRole: string): boolean {
  return WRITABLE_ACCESS_ROLES.includes(accessRole)
}
