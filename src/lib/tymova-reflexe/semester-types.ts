import type { Tables } from "@/lib/supabase/tables"
import type { Profile } from "@/lib/auth-helpers"

export type TeamAnnualReflection = Tables<"team_annual_reflections">
export type TeamAnnualReflectionEntry = Tables<"team_annual_reflection_entries">

export type TeamSemesterReflection = TeamAnnualReflection
export type TeamSemesterReflectionEntry = TeamAnnualReflectionEntry

export interface TeamAnnualReflectionWithCreator extends TeamAnnualReflection {
  created_by: Pick<Profile, "id" | "name" | "picture"> | null
}

export type TeamSemesterReflectionWithCreator = TeamAnnualReflectionWithCreator

export const ANNUAL_REFLECTION_SELECT =
  "*, created_by:profiles!created_by_profile_id(id, name, picture)"

export const SEMESTER_REFLECTION_SELECT = ANNUAL_REFLECTION_SELECT

export interface AnnualReflectionEntryWithUpdater extends TeamAnnualReflectionEntry {
  updated_by: Pick<Profile, "id" | "name" | "picture"> | null
}

export type SemesterReflectionEntryWithUpdater = AnnualReflectionEntryWithUpdater

export const ANNUAL_ENTRY_SELECT = "*, updated_by:profiles!updated_by_profile_id(id, name, picture)"
export const SEMESTER_ENTRY_SELECT = ANNUAL_ENTRY_SELECT

export const EDITABLE_ANNUAL_ENTRY_FIELDS = [
  "what_went_well",
  "what_didnt_go_well",
  "what_next_time",
] as const

export const EDITABLE_SEMESTER_ENTRY_FIELDS = EDITABLE_ANNUAL_ENTRY_FIELDS

export type EditableAnnualEntryField = (typeof EDITABLE_ANNUAL_ENTRY_FIELDS)[number]
export type EditableSemesterEntryField = EditableAnnualEntryField

export interface AnnualReflectionWithEntries {
  reflection: TeamAnnualReflectionWithCreator
  entries: AnnualReflectionEntryWithUpdater[]
}

export type SemesterReflectionWithEntries = AnnualReflectionWithEntries

export interface TeamAnnualReflectionSummary extends TeamAnnualReflectionWithCreator {
  filledTopicsCount: number
  totalTopicsCount: number
}

export type TeamSemesterReflectionSummary = TeamAnnualReflectionSummary
