import { pragueDateKey } from "./format"
import type { TrainingSessionListItem } from "./types"

/**
 * Reflections only nag for sessions from this Prague date onwards — older TS
 * ran before the team reflection existed and should not appear as unfinished.
 */
export const REFLECTIONS_SINCE_DATE = "2026-11-04"

type ReflectionCandidate = Pick<TrainingSessionListItem, "id" | "starts_at" | "cancelled_at">

/** True when a past TS still needs a team reflection. */
export function hasMissingReflection(session: ReflectionCandidate, reflectedIds: ReadonlySet<string>): boolean {
  if (session.cancelled_at) return false
  if (reflectedIds.has(session.id)) return false
  return pragueDateKey(session.starts_at) >= REFLECTIONS_SINCE_DATE
}
