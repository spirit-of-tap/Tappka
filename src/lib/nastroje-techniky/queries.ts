import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { ToolTechnique } from "./types"

export async function listToolsTechniques(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<ToolTechnique[]> {
  const { data, error } = await supabase
    .from("tools_techniques")
    .select("*")
    .is("removed_at", null)
    .eq("profile_id", profileId)
    .order("tool_type")
    .order("name")

  if (error) throw error
  return (data ?? []) as ToolTechnique[]
}
