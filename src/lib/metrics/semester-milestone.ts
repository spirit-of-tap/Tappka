import { getSemesterInfo } from "@/lib/timeline/semester-utils"

const DEFAULT_ONBOARDING_YEAR = 2025
const FALLBACK_SEMESTER = 2
const STUDY_SEMESTERS = 6

/** Study semester 1..6 for a cohort on a given date. */
export function currentStudySemester(now: Date, onboardingYear: number | null | undefined): number {
  const info = getSemesterInfo(now, onboardingYear ?? DEFAULT_ONBOARDING_YEAR)
  const semester = info?.studyYear
    ? (info.studyYear - 1) * 2 + (info.semester === "winter" ? 1 : 2)
    : FALLBACK_SEMESTER
  return Math.min(STUDY_SEMESTERS, Math.max(1, semester))
}

/**
 * Cumulative goal to reach by the end of the current semester: per-semester
 * target times semesters so far, capped at the whole-study total.
 */
export function cumulativeSemesterMilestone(
  semesterTarget: number,
  studyTarget: number,
  semester: number,
): number {
  return Math.min(studyTarget, semester * semesterTarget)
}
