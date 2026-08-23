/** Short numeric date for timeline pills, e.g. "12.10.". */
export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getDate()}.${pad(d.getMonth() + 1)}.`
}
