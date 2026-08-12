import type { Tables } from "@/lib/supabase/tables"
import type { Profile } from "@/lib/auth-helpers"

export type TeamSemesterReflection = Tables<"team_semester_reflections">
export type TeamSemesterReflectionEntry = Tables<"team_semester_reflection_entries">

export interface TeamSemesterReflectionWithCreator extends TeamSemesterReflection {
  created_by: Pick<Profile, "id" | "name" | "picture"> | null
}

export const SEMESTER_REFLECTION_SELECT =
  "*, created_by:profiles!created_by_profile_id(id, name, picture)"

export interface SemesterReflectionEntryWithUpdater extends TeamSemesterReflectionEntry {
  updated_by: Pick<Profile, "id" | "name" | "picture"> | null
}

export const SEMESTER_ENTRY_SELECT = "*, updated_by:profiles!updated_by_profile_id(id, name, picture)"

export const EDITABLE_SEMESTER_ENTRY_FIELDS = [
  "what_went_well",
  "what_didnt_go_well",
  "what_next_time",
] as const

export type EditableSemesterEntryField = (typeof EDITABLE_SEMESTER_ENTRY_FIELDS)[number]

export interface SemesterReflectionWithEntries {
  reflection: TeamSemesterReflectionWithCreator
  entries: SemesterReflectionEntryWithUpdater[]
}

export interface TeamSemesterReflectionSummary extends TeamSemesterReflectionWithCreator {
  filledTopicsCount: number
  totalTopicsCount: number
}
