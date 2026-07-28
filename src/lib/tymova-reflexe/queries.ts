import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { TeamReflectionWithCreator } from "./types"
import { REFLECTION_WITH_CREATOR_SELECT } from "./types"

export async function listTeamReflections(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<TeamReflectionWithCreator[]> {
  const { data, error } = await supabase
    .from("team_reflections")
    .select(REFLECTION_WITH_CREATOR_SELECT)
    .is("removed_at", null)
    .eq("team_id", teamId)
    .order("month", { ascending: false })

  if (error) throw error
  return (data ?? []) as TeamReflectionWithCreator[]
}

export async function getTeamReflectionForMonth(
  supabase: SupabaseClient<Database>,
  teamId: string,
  month: string,
): Promise<TeamReflectionWithCreator | null> {
  const { data, error } = await supabase
    .from("team_reflections")
    .select(REFLECTION_WITH_CREATOR_SELECT)
    .is("removed_at", null)
    .eq("team_id", teamId)
    .eq("month", month)
    .maybeSingle()

  if (error) throw error
  return data as TeamReflectionWithCreator | null
}
