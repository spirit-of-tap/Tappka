import type { Tables } from "@/lib/supabase/tables"
import type { Profile } from "@/lib/auth-helpers"

export type TeamActivity = Tables<"team_activities">

export interface TeamActivityWithCreator extends TeamActivity {
  created_by: Pick<Profile, "id" | "name" | "picture"> | null
  updated_by: Pick<Profile, "id" | "name" | "picture"> | null
}

export const ACTIVITY_WITH_CREATOR_SELECT =
  "*, created_by:profiles!created_by_profile_id(id, name, picture), updated_by:profiles!updated_by_profile_id(id, name, picture)"

export const EDITABLE_ACTIVITY_FIELDS = [
  "occurred_at",
  "activity_type",
  "participants",
  "reason",
  "reflection",
] as const

export type EditableActivityField = (typeof EDITABLE_ACTIVITY_FIELDS)[number]
