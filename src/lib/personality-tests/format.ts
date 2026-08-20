export function formatTestDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${Number(day)}. ${Number(month)}. ${year}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
}
