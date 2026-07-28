import type { Tables } from "@/lib/supabase/tables"
import type { Profile } from "@/lib/auth-helpers"

export type TeamReflection = Tables<"team_reflections">

export interface TeamReflectionWithCreator extends TeamReflection {
  created_by: Pick<Profile, "id" | "name" | "picture"> | null
  updated_by: Pick<Profile, "id" | "name" | "picture"> | null
}

export const REFLECTION_WITH_CREATOR_SELECT =
  "*, created_by:profiles!created_by_profile_id(id, name, picture), updated_by:profiles!updated_by_profile_id(id, name, picture)"

export const EDITABLE_REFLECTION_FIELDS = [
  "what_went_well",
  "what_didnt_go_well",
  "what_we_do_differently",
  "planned_action_steps",
  "responsible_person",
] as const

export type EditableReflectionField = (typeof EDITABLE_REFLECTION_FIELDS)[number]
