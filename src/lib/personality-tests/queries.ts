import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { PersonalityTest } from "./types"

export async function listPersonalityTests(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<PersonalityTest[]> {
  const { data, error } = await supabase
    .from("personality_tests")
    .select("*")
    .is("removed_at", null)
    .eq("profile_id", profileId)
    .order("tested_on", { ascending: false })

  if (error) throw error
  return (data ?? []) as PersonalityTest[]
}
