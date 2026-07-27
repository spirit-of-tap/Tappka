import type { Tables } from "@/lib/supabase/tables"
import type { Profile } from "@/lib/auth-helpers"

export type IndividualCoachingSession = Tables<"individual_coaching_sessions">

export interface IndividualCoachingSessionWithCoach extends IndividualCoachingSession {
  coach: Pick<Profile, "id" | "name" | "picture"> | null
}

export function coachDisplayName(session: IndividualCoachingSessionWithCoach): string {
  return session.coach?.name ?? session.external_coach_name ?? ""
}

/** Shared select fragment: embeds the coach profile so callers get `IndividualCoachingSessionWithCoach` back. */
export const SESSION_WITH_COACH_SELECT = "*, coach:profiles!coach_profile_id(id, name, picture)"
