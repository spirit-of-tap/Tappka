import { MS_PER_HOUR, PRAGUE_TIME_ZONE, TIME_DIRECTION_LABELS, TIME_DIRECTIONS } from "./constants"
import { entryDurationMs } from "./duration"
import { summarize, toPragueDateKey } from "./week"
import type { TeamMember, TimeDirection, TimeEntry, TimeEntryWithTag, TimeRange, TimeTag } from "./types"

/** What one bar segment sums: a whole direction or a single tag. */
export type ReportSeriesKey = `direction:${TimeDirection}` | `tag:${string}`

export interface ReportSeries {
  key: ReportSeriesKey
  label: string
  /** Direction the series belongs to (for grouping and colour). */
  direction: TimeDirection
}

export interface ReportRow {
  memberId: string
  memberName: string
  /** Hours per series key, rounded to `HOURS_PRECISION` decimals. */
  hours: Record<ReportSeriesKey, number>
  /** Sum of the row's series (not the member's total time when only some series are shown). */
  totalHours: number
}

/** Decimal places kept for hours in charts and CSV. */
export const HOURS_PRECISION = 2

export function directionSeriesKey(direction: TimeDirection): ReportSeriesKey {
  return `direction:${direction}`
}

export function tagSeriesKey(tagId: string): ReportSeriesKey {
  return `tag:${tagId}`
}

/** Default Y axis: all four directions stacked. */
export const DEFAULT_REPORT_SERIES: readonly ReportSeriesKey[] = TIME_DIRECTIONS.map((direction) =>
  directionSeriesKey(direction.value),
)

/** Every series the Y axis can show: the four directions, then each tag (system and team). */
export function availableSeries(tags: readonly TimeTag[]): ReportSeries[] {
  const directions = TIME_DIRECTIONS.map((direction) => ({
    key: directionSeriesKey(direction.value),
    label: direction.label,
    direction: direction.value,
  }))
  const tagSeries = TIME_DIRECTIONS.flatMap((direction) =>
    tags
      .filter((tag) => tag.direction === direction.value)
      .map((tag) => ({ key: tagSeriesKey(tag.id), label: tag.name, direction: tag.direction })),
  )
  return [...directions, ...tagSeries]
}

function roundHours(ms: number): number {
  const factor = 10 ** HOURS_PRECISION
  return Math.round((ms / MS_PER_HOUR) * factor) / factor
}

export interface BuildReportParams {
  members: readonly TeamMember[]
  entries: readonly TimeEntry[]
  series: readonly ReportSeriesKey[]
  /** Entries are clipped to this range; running timers count until `now`. */
  range: TimeRange
  now: Date
}

/** One row per member (in the given order) with hours for each requested series. */
export function buildReportRows({ members, entries, series, range, now }: BuildReportParams): ReportRow[] {
  const byMember = new Map<string, TimeEntry[]>()
  for (const entry of entries) {
    const list = byMember.get(entry.profile_id)
    if (list) list.push(entry)
    else byMember.set(entry.profile_id, [entry])
  }

  return members.map((member) => {
    const summary = summarize(byMember.get(member.id) ?? [], { includeRunning: true, now, range })
    const hours = {} as Record<ReportSeriesKey, number>
    let totalMs = 0
    for (const key of series) {
      const [kind, id] = splitSeriesKey(key)
      const ms = kind === "direction" ? summary.byDirection[id as TimeDirection] : (summary.byTag.get(id) ?? 0)
      hours[key] = roundHours(ms)
      totalMs += ms
    }
    return { memberId: member.id, memberName: member.name, hours, totalHours: roundHours(totalMs) }
  })
}

function splitSeriesKey(key: ReportSeriesKey): ["direction" | "tag", string] {
  const separator = key.indexOf(":")
  return [key.slice(0, separator) as "direction" | "tag", key.slice(separator + 1)]
}

/** Label of a series key, falling back for tags that were deleted since. */
export function seriesLabel(key: ReportSeriesKey, series: readonly ReportSeries[]): string {
  const found = series.find((candidate) => candidate.key === key)
  if (found) return found.label
  const [kind, id] = splitSeriesKey(key)
  return kind === "direction" ? TIME_DIRECTION_LABELS[id as TimeDirection] : "Smazaný tag"
}

const CSV_SEPARATOR = ","
const CSV_LINE_BREAK = "\r\n"
/** Excel opens UTF-8 CSV with diacritics correctly only with a BOM. */
const CSV_BOM = "﻿"

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** CSV text from a header and rows; RFC 4180 quoting, BOM for Excel. */
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(CSV_SEPARATOR))
  return CSV_BOM + lines.join(CSV_LINE_BREAK) + CSV_LINE_BREAK
}

/** Chart data as CSV: one row per member, one column per series plus a total. */
export function reportRowsToCsv(
  rows: readonly ReportRow[],
  seriesKeys: readonly ReportSeriesKey[],
  series: readonly ReportSeries[],
): string {
  const header = ["Člen:ka", ...seriesKeys.map((key) => `${seriesLabel(key, series)} (h)`), "Celkem (h)"]
  return toCsv(
    header,
    rows.map((row) => [row.memberName, ...seriesKeys.map((key) => row.hours[key]), row.totalHours]),
  )
}

const PRAGUE_TIME_FORMAT = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: PRAGUE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

function pragueDateTime(instant: string): string {
  return `${toPragueDateKey(instant)} ${PRAGUE_TIME_FORMAT.format(new Date(instant))}`
}

export interface EntriesCsvParams {
  members: readonly TeamMember[]
  entries: readonly TimeEntryWithTag[]
  now: Date
}

/**
 * Every entry as one CSV row (oldest first) — the raw export for spreadsheets or an AI
 * assistant. Hours are the entry's full length; running timers count until `now`.
 */
export function entriesToCsv({ members, entries, now }: EntriesCsvParams): string {
  const names = new Map(members.map((member) => [member.id, member.name]))
  const sorted = [...entries].sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))
  return toCsv(
    ["Datum", "Člen:ka", "Směr", "Tag", "Co konkrétně", "Začátek", "Konec", "Hodiny"],
    sorted.map((entry) => [
      toPragueDateKey(entry.started_at),
      names.get(entry.profile_id) ?? "",
      TIME_DIRECTION_LABELS[entry.direction],
      entry.tag?.name ?? "",
      entry.title ?? "",
      pragueDateTime(entry.started_at),
      entry.ended_at === null ? "" : pragueDateTime(entry.ended_at),
      roundHours(entryDurationMs(entry, now)),
    ]),
  )
}
