const MONTH_LABELS = [
  "Leden",
  "Únor",
  "Březen",
  "Duben",
  "Květen",
  "Červen",
  "Červenec",
  "Srpen",
  "Září",
  "Říjen",
  "Listopad",
  "Prosinec",
] as const

export function formatActivityDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${Number(day)}. ${Number(month)}. ${year}`
}

export function getActivityMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export function getActivityMonthLabel(key: string): string {
  const [year, month] = key.split("-")
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`
}
