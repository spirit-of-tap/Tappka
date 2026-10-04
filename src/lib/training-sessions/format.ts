import { PRAGUE_TIME_ZONE } from "./constants"

const DATE_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: PRAGUE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
const DAY_HEADING_FORMAT = new Intl.DateTimeFormat("cs-CZ", { timeZone: PRAGUE_TIME_ZONE, weekday: "long", day: "numeric", month: "long" })
const TIME_FORMAT = new Intl.DateTimeFormat("cs-CZ", { timeZone: PRAGUE_TIME_ZONE, hour: "numeric", minute: "2-digit" })

export interface DayGroup<T> {
  dateKey: string
  heading: string
  items: T[]
}

export function pragueDateKey(value: string | Date): string {
  return DATE_KEY_FORMAT.format(typeof value === "string" ? new Date(value) : value)
}

export function formatDayHeading(iso: string): string {
  const text = DAY_HEADING_FORMAT.format(new Date(iso))
  return text.charAt(0).toLocaleUpperCase("cs-CZ") + text.slice(1)
}

export function formatTime(iso: string): string {
  return TIME_FORMAT.format(new Date(iso))
}

export function toTimeInputValue(iso: string): string {
  return formatTime(iso).padStart(5, "0")
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)}–${formatTime(endIso)}`
}

export function groupByPragueDay<T>(items: T[], getStart: (item: T) => string): DayGroup<T>[] {
  const groups: DayGroup<T>[] = []
  for (const item of items) {
    const start = getStart(item)
    const dateKey = pragueDateKey(start)
    const last = groups.at(-1)
    if (last?.dateKey === dateKey) last.items.push(item)
    else groups.push({ dateKey, heading: formatDayHeading(start), items: [item] })
  }
  return groups
}

/** Names shown in full before the rest collapse into "+N". */
export const PEOPLE_PREVIEW_COUNT = 3

/** "Anna, Petr, Klára +2" — a compact list of who will be there. */
export function formatPeopleList(names: string[], max: number = PEOPLE_PREVIEW_COUNT): string {
  const shown = names.slice(0, max).join(", ")
  const rest = names.length - max
  return rest > 0 ? `${shown} +${rest}` : shown
}

/** Share of the team color mixed into a card surface — enough to tell teams apart, not enough to hurt contrast. */
const TEAM_TINT_PERCENT = 7

/**
 * Inline styles that mark a surface with its team's color. Team colors are user data,
 * so they can't be semantic tokens; an invalid value is simply dropped by the browser.
 */
export function teamAccentStyles(color: string | null | undefined): {
  stripe: { backgroundColor: string } | undefined
  surface: { backgroundImage: string } | undefined
} {
  if (!color) return { stripe: undefined, surface: undefined }
  const tint = `color-mix(in oklab, ${color} ${TEAM_TINT_PERCENT}%, transparent)`
  return { stripe: { backgroundColor: color }, surface: { backgroundImage: `linear-gradient(${tint}, ${tint})` } }
}
