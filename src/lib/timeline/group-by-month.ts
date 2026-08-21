export const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Returns the viewer-local month key (`YYYY-MM`) for a full ISO timestamp,
 * or "" when the value is null or unparseable — such values are treated as
 * undated by {@link groupByMonth}.
 *
 * Month bucketing follows the viewer-local calendar month (consistent with
 * how {@link groupByMonth} derives the current month from `now`); SSR output
 * is only stable when server and client share a timezone.
 */
export function getMonthKey(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ""
  return toMonthKey(d)
}

export function getMonthLabel(key: string): string {
  const [year, month] = key.split("-")
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`
}

export function monthKeyToDate(key: string): Date {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1)
}

export function addMonths(key: string, n: number): string {
  const d = monthKeyToDate(key)
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export interface MonthGroup<T> {
  key: string
  label: string
  items: T[]
}

export interface GroupedByMonth<T> {
  groups: MonthGroup<T>[]
  undated: T[]
}

/**
 * Groups items into calendar months, newest first. The span always covers
 * current month → earliest item month, and extends forward to the latest
 * item month so planned/future entries stay visible.
 *
 * Expects full ISO timestamps from `getDate`. Items with null or unparseable
 * dates are returned under `undated`. Items keep their input order within
 * each month — pre-sort items newest-first before calling.
 *
 * Month bucketing follows the viewer-local calendar month (consistent with
 * how the current month is derived from `now`); SSR output is only stable
 * when server and client share a timezone.
 */
export function groupByMonth<T>(
  items: T[],
  { getDate, now = new Date() }: { getDate: (item: T) => string | null; now?: Date },
): GroupedByMonth<T> {
  const byKey = new Map<string, T[]>()
  const undated: T[] = []
  const currentKey = toMonthKey(now)

  let minKey = currentKey
  let maxKey = currentKey
  let hasDated = false

  for (const item of items) {
    const key = getMonthKey(getDate(item))
    if (!key) {
      undated.push(item)
      continue
    }
    const list = byKey.get(key) ?? []
    list.push(item)
    byKey.set(key, list)
    hasDated = true
    if (key < minKey) minKey = key
    if (key > maxKey) maxKey = key
  }

  if (!hasDated) return { groups: [], undated }

  const groups: MonthGroup<T>[] = []
  let cursor = maxKey
  while (cursor >= minKey) {
    groups.push({ key: cursor, label: getMonthLabel(cursor), items: byKey.get(cursor) ?? [] })
    cursor = addMonths(cursor, -1)
  }
  return { groups, undated }
}
