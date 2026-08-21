export const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

export function getMonthKey(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
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
 */
export function groupByMonth<T>(
  items: T[],
  { getDate, now = new Date() }: { getDate: (item: T) => string | null; now?: Date },
): GroupedByMonth<T> {
  const byKey = new Map<string, T[]>()
  const undated: T[] = []
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  let minKey = currentKey
  let maxKey = currentKey
  let hasDated = false

  for (const item of items) {
    const key = getMonthKey(getDate(item))
    if (!key) {
      undated.push(item)
      continue
    }
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(item)
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
