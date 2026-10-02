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
