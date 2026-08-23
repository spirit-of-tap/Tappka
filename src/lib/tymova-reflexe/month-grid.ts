export type MonthCellStatus = "done" | "current-missing" | "missing" | "future"

export interface MonthCell {
  month: string
  monthlyStatus: MonthCellStatus
  monthlyReflectionId: string | null
  isMay: boolean
  rocnikovaStatus?: MonthCellStatus
  rocnikovaReflectionId?: string | null
}

export interface SchoolYear {
  startYear: number
  label: string
  rocnik: number | null
  isCurrentYear: boolean
  completedCount: number
  totalCount: number
  months: MonthCell[]
}

export interface ReflectionRef {
  id: string
  month: string
}

// A school year runs October through May. All 8 months have monthly reflections,
// and May additionally has the comprehensive Ročníková reflexe.
// The study program is fixed at 3 years.
export const SCHOOL_YEAR_MONTHS = [10, 11, 12, 1, 2, 3, 4, 5] as const

export function isRocnikovaMonth(monthKey: string): boolean {
  const parts = monthKey.split("-")
  const month = Number(parts[1])
  return month === 5
}

/** Backward compatibility alias. */
export const isSemesterMonth = isRocnikovaMonth

const PROGRAM_LENGTH_YEARS = 3

export function schoolYearStartYearFor(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number)
  return month >= 9 ? year : year - 1
}

function monthKeyFor(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`
}

/**
 * Normalizes onboardingYear to a valid 4-digit calendar year.
 * If raw is a small number (1, 2, 3), it represents the relative ročník.
 */
export function normalizeOnboardingYear(
  rawYear: number | null | undefined,
  currentStartYear: number,
): number {
  if (typeof rawYear === "number") {
    if (rawYear >= 1900 && rawYear <= 2100) {
      return rawYear
    }
    if (rawYear >= 1 && rawYear <= 3) {
      return currentStartYear - (rawYear - 1)
    }
  }
  return currentStartYear
}

/**
 * A team's ročník (1st/2nd/3rd study year) for a given school year, derived
 * from the effective 4-digit start onboarding year.
 */
export function rocnikForSchoolYear(effectiveOnboardingYear: number, startYear: number): number | null {
  const rocnik = startYear - effectiveOnboardingYear + 1
  return rocnik >= 1 && rocnik <= 3 ? rocnik : null
}

function computeStatus(
  reflectionId: string | null,
  key: string,
  currentMonth: string,
): MonthCellStatus {
  if (reflectionId) return "done"
  if (key > currentMonth) return "future"
  if (key === currentMonth) return "current-missing"
  return "missing"
}

function buildMonths(
  startYear: number,
  currentMonth: string,
  monthlyMap: Map<string, string>,
  rocnikovaMap: Map<string, string>,
): MonthCell[] {
  return SCHOOL_YEAR_MONTHS.map((m) => {
    const year = m >= 9 ? startYear : startYear + 1
    const key = monthKeyFor(year, m)
    const isMay = m === 5

    const monthlyReflectionId = monthlyMap.get(key) ?? null
    const monthlyStatus = computeStatus(monthlyReflectionId, key, currentMonth)

    const cell: MonthCell = {
      month: key,
      monthlyStatus,
      monthlyReflectionId,
      isMay,
    }

    if (isMay) {
      const rocnikovaReflectionId = rocnikovaMap.get(key) ?? null
      cell.rocnikovaStatus = computeStatus(rocnikovaReflectionId, key, currentMonth)
      cell.rocnikovaReflectionId = rocnikovaReflectionId
    }

    return cell
  })
}

/**
 * Builds the 3 school years (October–May) for the team's roadmap.
 */
export function buildSchoolYears(
  monthlyReflections: ReflectionRef[],
  rocnikovaReflections: ReflectionRef[],
  currentMonth: string,
  _yearsBack = 2,
  onboardingYear: number | null = null,
): SchoolYear[] {
  const monthlyMap = new Map(monthlyReflections.map((r) => [r.month, r.id]))
  const rocnikovaMap = new Map(rocnikovaReflections.map((r) => [r.month, r.id]))
  const currentStartYear = schoolYearStartYearFor(currentMonth)

  const effectiveOnboardingYear = normalizeOnboardingYear(onboardingYear, currentStartYear)

  const startYears = Array.from(
    { length: PROGRAM_LENGTH_YEARS },
    (_, i) => effectiveOnboardingYear + i,
  )

  return startYears.map((startYear) => {
    const months = buildMonths(startYear, currentMonth, monthlyMap, rocnikovaMap)
    let completedCount = 0
    let totalCount = 0

    for (const cell of months) {
      totalCount += 1
      if (cell.monthlyStatus === "done") completedCount += 1
      if (cell.isMay) {
        totalCount += 1
        if (cell.rocnikovaStatus === "done") completedCount += 1
      }
    }

    return {
      startYear,
      label: `${startYear}/${startYear + 1}`,
      rocnik: rocnikForSchoolYear(effectiveOnboardingYear, startYear),
      isCurrentYear: startYear === currentStartYear,
      completedCount,
      totalCount,
      months,
    }
  })
}
