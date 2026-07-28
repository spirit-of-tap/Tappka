export type MonthCellKind = "monthly" | "semester"
export type MonthCellStatus = "done" | "current-missing" | "missing" | "future"

export interface MonthCell {
  month: string
  kind: MonthCellKind
  status: MonthCellStatus
  reflectionId: string | null
}

export interface SchoolYear {
  startYear: number
  label: string
  rocnik: number | null
  months: MonthCell[]
}

interface ReflectionRef {
  id: string
  month: string
}

// A school year runs September through May; semester reflections replace the
// monthly one in January and May. The program itself is fixed at 3 years.
const SCHOOL_YEAR_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5]
const SEMESTER_MONTHS = new Set([1, 5])

export function isSemesterMonth(monthKey: string): boolean {
  const month = Number(monthKey.split("-")[1])
  return SEMESTER_MONTHS.has(month)
}

const PROGRAM_LENGTH_YEARS = 3

function schoolYearStartYearFor(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number)
  return month >= 9 ? year : year - 1
}

function monthKeyFor(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`
}

/**
 * A team's ročník (1st/2nd/3rd study year) for a given school year, derived
 * from teams.onboardingYear — the calendar year their first school year
 * started. Returns null if unset or the school year predates onboarding.
 */
export function rocnikForSchoolYear(onboardingYear: number | null, startYear: number): number | null {
  if (onboardingYear == null) return null
  const rocnik = startYear - onboardingYear + 1
  return rocnik >= 1 ? rocnik : null
}

function buildMonths(
  startYear: number,
  currentMonth: string,
  monthlyMap: Map<string, string>,
  semesterMap: Map<string, string>,
): MonthCell[] {
  return SCHOOL_YEAR_MONTHS.map((m) => {
    const year = m >= 9 ? startYear : startYear + 1
    const key = monthKeyFor(year, m)
    const kind: MonthCellKind = SEMESTER_MONTHS.has(m) ? "semester" : "monthly"
    const reflectionId = (kind === "semester" ? semesterMap : monthlyMap).get(key) ?? null

    const status: MonthCellStatus = reflectionId
      ? "done"
      : key > currentMonth
        ? "future"
        : key === currentMonth
          ? "current-missing"
          : "missing"

    return { month: key, kind, status, reflectionId }
  })
}

/**
 * Builds the school years (September–May) to show on the reflection
 * calendar, oldest first.
 *
 * When `onboardingYear` is known, this is the team's whole fixed 3-year
 * program (ročník 1 through 3) regardless of the current date — future
 * ročníky are shown too, as a roadmap, with their months marked "future"
 * rather than omitted. Without an onboarding year we can't know the
 * program's bounds, so it falls back to a trailing `yearsBack + 1` window
 * ending at the school year containing `currentMonth`.
 */
export function buildSchoolYears(
  monthlyReflections: ReflectionRef[],
  semesterReflections: ReflectionRef[],
  currentMonth: string,
  yearsBack = 2,
  onboardingYear: number | null = null,
): SchoolYear[] {
  const monthlyMap = new Map(monthlyReflections.map((r) => [r.month, r.id]))
  const semesterMap = new Map(semesterReflections.map((r) => [r.month, r.id]))
  const currentStartYear = schoolYearStartYearFor(currentMonth)

  const startYears =
    onboardingYear !== null
      ? Array.from({ length: PROGRAM_LENGTH_YEARS }, (_, i) => onboardingYear + i)
      : Array.from({ length: yearsBack + 1 }, (_, i) => currentStartYear - yearsBack + i)

  return startYears.map((startYear) => ({
    startYear,
    label: `${startYear}/${startYear + 1}`,
    rocnik: rocnikForSchoolYear(onboardingYear, startYear),
    months: buildMonths(startYear, currentMonth, monthlyMap, semesterMap),
  }))
}
