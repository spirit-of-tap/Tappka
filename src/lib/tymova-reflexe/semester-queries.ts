import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import {
  ANNUAL_ENTRY_SELECT,
  ANNUAL_REFLECTION_SELECT,
  type AnnualReflectionEntryWithUpdater,
  type AnnualReflectionWithEntries,
  type TeamAnnualReflectionSummary,
  type TeamAnnualReflectionWithCreator,
} from "./semester-types"
import { ROCNIKOVA_REFLECTION_TOPICS } from "./semester-topics"

export async function listTeamAnnualReflections(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<TeamAnnualReflectionWithCreator[]> {
  const { data, error } = await supabase
    .from("team_annual_reflections")
    .select(ANNUAL_REFLECTION_SELECT)
    .is("removed_at", null)
    .eq("team_id", teamId)
    .order("reflection_month", { ascending: false })

  if (error) throw error
  return (data ?? []) as TeamAnnualReflectionWithCreator[]
}

export const listTeamSemesterReflections = listTeamAnnualReflections

/** Same as listTeamAnnualReflections, plus how many of the fixed topics have any content — for list previews. */
export async function listTeamAnnualReflectionsWithProgress(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<TeamAnnualReflectionSummary[]> {
  const reflections = await listTeamAnnualReflections(supabase, teamId)
  if (reflections.length === 0) return []

  const { data: entries, error } = await supabase
    .from("team_annual_reflection_entries")
    .select("annual_reflection_id, what_went_well, what_didnt_go_well, what_next_time")
    .in("annual_reflection_id", reflections.map((r) => r.id))

  if (error) throw error

  const filledByReflection = new Map<string, number>()
  for (const entry of entries ?? []) {
    const hasContent = Boolean(
      entry.what_went_well?.trim() || entry.what_didnt_go_well?.trim() || entry.what_next_time?.trim(),
    )
    if (!hasContent) continue
    filledByReflection.set(
      entry.annual_reflection_id,
      (filledByReflection.get(entry.annual_reflection_id) ?? 0) + 1,
    )
  }

  return reflections.map((reflection) => ({
    ...reflection,
    filledTopicsCount: filledByReflection.get(reflection.id) ?? 0,
    totalTopicsCount: ROCNIKOVA_REFLECTION_TOPICS.length,
  }))
}

export const listTeamSemesterReflectionsWithProgress = listTeamAnnualReflectionsWithProgress

export async function getAnnualReflectionForTeamMonth(
  supabase: SupabaseClient<Database>,
  teamId: string,
  reflectionMonth: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("team_annual_reflections")
    .select("id")
    .is("removed_at", null)
    .eq("team_id", teamId)
    .eq("reflection_month", reflectionMonth)
    .maybeSingle()

  if (error) throw error
  return data
}

export const getSemesterReflectionForTeamMonth = getAnnualReflectionForTeamMonth

export async function getAnnualReflectionWithEntries(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<AnnualReflectionWithEntries | null> {
  const { data: reflection, error: reflectionError } = await supabase
    .from("team_annual_reflections")
    .select(ANNUAL_REFLECTION_SELECT)
    .is("removed_at", null)
    .eq("id", id)
    .maybeSingle()

  if (reflectionError) throw reflectionError
  if (!reflection) return null

  const { data: entries, error: entriesError } = await supabase
    .from("team_annual_reflection_entries")
    .select(ANNUAL_ENTRY_SELECT)
    .eq("annual_reflection_id", id)

  if (entriesError) throw entriesError

  return {
    reflection: reflection as TeamAnnualReflectionWithCreator,
    entries: (entries ?? []) as AnnualReflectionEntryWithUpdater[],
  }
}

export const getSemesterReflectionWithEntries = getAnnualReflectionWithEntries

/** Creates an annual reflection and pre-seeds one entry row per topic. */
export async function createAnnualReflection(
  supabase: SupabaseClient<Database>,
  teamId: string,
  reflectionMonth: string,
  profileId: string,
): Promise<{ id: string }> {
  const { data: reflection, error: reflectionError } = await supabase
    .from("team_annual_reflections")
    .insert({
      team_id: teamId,
      reflection_month: reflectionMonth,
      created_by_profile_id: profileId,
      updated_by_profile_id: profileId,
    })
    .select("id")
    .single()

  if (reflectionError) throw reflectionError

  const { error: entriesError } = await supabase.from("team_annual_reflection_entries").insert(
    ROCNIKOVA_REFLECTION_TOPICS.map((topic) => ({
      annual_reflection_id: reflection.id,
      topic: topic.key,
      updated_by_profile_id: profileId,
    })),
  )

  if (entriesError) throw entriesError

  return { id: reflection.id }
}

export const createSemesterReflection = createAnnualReflection
