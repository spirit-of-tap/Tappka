import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { TeamActivityWithCreator } from "./types"
import { ACTIVITY_WITH_CREATOR_SELECT } from "./types"

export async function listTeamActivities(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<TeamActivityWithCreator[]> {
  const { data, error } = await supabase
    .from("team_activities")
    .select(ACTIVITY_WITH_CREATOR_SELECT)
    .is("removed_at", null)
    .eq("team_id", teamId)
    .order("occurred_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as TeamActivityWithCreator[]
}

export async function getTeamActivityById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<TeamActivityWithCreator | null> {
  const { data, error } = await supabase
    .from("team_activities")
    .select(ACTIVITY_WITH_CREATOR_SELECT)
    .is("removed_at", null)
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return data as TeamActivityWithCreator | null
}
