import { getWeekRange } from "@/lib/time-tracking/week"

/**
 * Czech academic year splits roughly into a winter semester (September–January)
 * and a summer semester (February–August, which absorbs the summer break).
 */
const WINTER_SEMESTER_START_MONTH = 9 // September (1-indexed month)
const SUMMER_SEMESTER_START_MONTH = 2 // February (1-indexed month)

export function getCurrentSemesterRange(now: Date): { start: Date; end: Date } {
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  if (month >= WINTER_SEMESTER_START_MONTH) {
    // September–December: winter semester runs into January of next year.
    return { start: new Date(year, 8, 1), end: new Date(year + 1, 1, 1) }
  }
  if (month < SUMMER_SEMESTER_START_MONTH) {
    // January: still the winter semester that started last September.
    return { start: new Date(year - 1, 8, 1), end: new Date(year, 1, 1) }
  }
  // February–August: summer semester.
  return { start: new Date(year, 1, 1), end: new Date(year, 8, 1) }
}

/**
 * Current calendar week: Monday 00:00 Europe/Prague wall-clock time up to next
 * Monday 00:00 (exclusive end), matching the Czech week.
 *
 * Delegates to `time-tracking/week.getWeekRange` so the "current week" agrees
 * everywhere in the app regardless of the server's runtime time zone — computing
 * this independently in the server's local time zone (as this used to do via
 * `date-fns`'s `startOfWeek`) silently disagreed with the time-tracking module's
 * Prague-based week whenever the two time zones differ (e.g. UTC in CI/production
 * vs. Europe/Prague on a dev machine).
 */
export function getCurrentWeekRange(now: Date): { start: Date; end: Date } {
  const { from, to } = getWeekRange(now)
  return { start: from, end: to }
}
