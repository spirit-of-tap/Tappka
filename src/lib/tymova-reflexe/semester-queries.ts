import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import {
  SEMESTER_ENTRY_SELECT,
  SEMESTER_REFLECTION_SELECT,
  type SemesterReflectionEntryWithUpdater,
  type SemesterReflectionWithEntries,
  type TeamSemesterReflectionSummary,
  type TeamSemesterReflectionWithCreator,
} from "./semester-types"
import { SEMESTER_REFLECTION_TOPICS } from "./semester-topics"

export async function listTeamSemesterReflections(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<TeamSemesterReflectionWithCreator[]> {
  const { data, error } = await supabase
    .from("team_semester_reflections")
    .select(SEMESTER_REFLECTION_SELECT)
    .is("removed_at", null)
    .eq("team_id", teamId)
    .order("semester_month", { ascending: false })

  if (error) throw error
  return (data ?? []) as TeamSemesterReflectionWithCreator[]
}

/** Same as listTeamSemesterReflections, plus how many of the fixed topics have any content — for list previews. */
export async function listTeamSemesterReflectionsWithProgress(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<TeamSemesterReflectionSummary[]> {
  const reflections = await listTeamSemesterReflections(supabase, teamId)
  if (reflections.length === 0) return []

  const { data: entries, error } = await supabase
    .from("team_semester_reflection_entries")
    .select("semester_reflection_id, what_went_well, what_didnt_go_well, what_next_time")
    .in("semester_reflection_id", reflections.map((r) => r.id))

  if (error) throw error

  const filledByReflection = new Map<string, number>()
  for (const entry of entries ?? []) {
    const hasContent = Boolean(
      entry.what_went_well?.trim() || entry.what_didnt_go_well?.trim() || entry.what_next_time?.trim(),
    )
    if (!hasContent) continue
    filledByReflection.set(
      entry.semester_reflection_id,
      (filledByReflection.get(entry.semester_reflection_id) ?? 0) + 1,
    )
  }

  return reflections.map((reflection) => ({
    ...reflection,
    filledTopicsCount: filledByReflection.get(reflection.id) ?? 0,
    totalTopicsCount: SEMESTER_REFLECTION_TOPICS.length,
  }))
}

export async function getSemesterReflectionForTeamMonth(
  supabase: SupabaseClient<Database>,
  teamId: string,
  semesterMonth: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("team_semester_reflections")
    .select("id")
    .is("removed_at", null)
    .eq("team_id", teamId)
    .eq("semester_month", semesterMonth)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getSemesterReflectionWithEntries(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<SemesterReflectionWithEntries | null> {
  const { data: reflection, error: reflectionError } = await supabase
    .from("team_semester_reflections")
    .select(SEMESTER_REFLECTION_SELECT)
    .is("removed_at", null)
    .eq("id", id)
    .maybeSingle()

  if (reflectionError) throw reflectionError
  if (!reflection) return null

  const { data: entries, error: entriesError } = await supabase
    .from("team_semester_reflection_entries")
    .select(SEMESTER_ENTRY_SELECT)
    .eq("semester_reflection_id", id)

  if (entriesError) throw entriesError

  return {
    reflection: reflection as TeamSemesterReflectionWithCreator,
    entries: (entries ?? []) as SemesterReflectionEntryWithUpdater[],
  }
}

/** Creates a semester reflection and pre-seeds one entry row per topic. */
export async function createSemesterReflection(
  supabase: SupabaseClient<Database>,
  teamId: string,
  semesterMonth: string,
  profileId: string,
): Promise<{ id: string }> {
  const { data: reflection, error: reflectionError } = await supabase
    .from("team_semester_reflections")
    .insert({
      team_id: teamId,
      semester_month: semesterMonth,
      created_by_profile_id: profileId,
      updated_by_profile_id: profileId,
    })
    .select("id")
    .single()

  if (reflectionError) throw reflectionError

  const { error: entriesError } = await supabase.from("team_semester_reflection_entries").insert(
    SEMESTER_REFLECTION_TOPICS.map((topic) => ({
      semester_reflection_id: reflection.id,
      topic: topic.key,
      updated_by_profile_id: profileId,
    })),
  )

  if (entriesError) throw entriesError

  return { id: reflection.id }
}
