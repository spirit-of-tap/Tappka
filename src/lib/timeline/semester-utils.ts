/**
 * Utilities for bucketing dates and month keys into Czech academic semesters and years.
 *
 * Czech academic year runs:
 * - Zimní semestr (ZS): September–January (months 9, 10, 11, 12, 1)
 * - Letní semestr (LS): February–August (months 2, 3, 4, 5, 6, 7, 8)
 */

export interface SemesterInfo {
  key: string // e.g. "2025-ZS", "2025-LS"
  semester: "winter" | "summer"
  semesterName: "Zimní semestr" | "Letní semestr"
  academicStartYear: number
  academicYearLabel: string // e.g. "2025/2026"
  studyYear: number | null // e.g. 1, 2, 3 (if onboardingYear is provided)
  label: string // e.g. "1. ročník — Zimní semestr (2025/2026)" or "Zimní semestr 2025/2026"
}

export function getSemesterInfo(
  dateOrMonthStr: string | Date | null | undefined,
  onboardingYear?: number | null,
): SemesterInfo | null {
  if (!dateOrMonthStr) return null

  let year: number
  let month: number

  if (dateOrMonthStr instanceof Date) {
    if (Number.isNaN(dateOrMonthStr.getTime())) return null
    year = dateOrMonthStr.getFullYear()
    month = dateOrMonthStr.getMonth() + 1
  } else {
    // String in format "YYYY-MM-DD" or "YYYY-MM" or ISO
    const parts = dateOrMonthStr.split("T")[0].split("-")
    if (parts.length < 2) return null
    year = Number(parts[0])
    month = Number(parts[1])
    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) return null
  }

  const isWinter = month >= 9 || month === 1
  const semester: "winter" | "summer" = isWinter ? "winter" : "summer"
  const semesterName = isWinter ? "Zimní semestr" : "Letní semestr"
  const academicStartYear = month >= 9 ? year : year - 1
  const academicYearLabel = `${academicStartYear}/${academicStartYear + 1}`
  const key = `${academicStartYear}-${isWinter ? "ZS" : "LS"}`

  let studyYear: number | null = null
  if (onboardingYear && onboardingYear > 1900 && onboardingYear <= 2100) {
    const diff = academicStartYear - onboardingYear
    if (diff >= 0 && diff < 10) {
      studyYear = diff + 1
    }
  }

  const label = studyYear
    ? `${studyYear}. ročník — ${semesterName} (${academicYearLabel})`
    : `${semesterName} ${academicYearLabel}`

  return {
    key,
    semester,
    semesterName,
    academicStartYear,
    academicYearLabel,
    studyYear,
    label,
  }
}
