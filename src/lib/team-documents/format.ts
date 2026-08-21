export function formatDocumentDate(dateString: string): string {
  const [year, month, day] = dateString.slice(0, 10).split("-")
  return `${Number(day)}. ${Number(month)}. ${year}`
}

export function formatDocumentFileSize(bytes: number): string {
  const KILOBYTE = 1024
  const MEGABYTE = KILOBYTE * KILOBYTE

  if (bytes < KILOBYTE) return `${bytes} B`
  if (bytes < MEGABYTE) return `${Math.round(bytes / KILOBYTE)} KB`
  return `${(bytes / MEGABYTE).toFixed(1).replace(".", ",")} MB`
}

export function formatVersionLabel(versionNumber: number): string {
  return `Verze ${versionNumber}`
}
