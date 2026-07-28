import type { Tables } from "@/lib/supabase/tables"
import type { Profile } from "@/lib/auth-helpers"

export type TeamReflection = Tables<"team_reflections">

export interface TeamReflectionWithCreator extends TeamReflection {
  created_by: Pick<Profile, "id" | "name" | "picture"> | null
}

export const REFLECTION_WITH_CREATOR_SELECT = "*, created_by:profiles!created_by_profile_id(id, name, picture)"
