import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { Profile } from "@/lib/auth-helpers"
import type { IndividualCoachingSessionWithCoach } from "./types"
import { SESSION_WITH_COACH_SELECT } from "./types"
import { createAdminClient } from "@/lib/supabase/admin"

export async function listIndividualCoachingSessions(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<IndividualCoachingSessionWithCoach[]> {
  const { data, error } = await supabase
    .from("individual_coaching_sessions")
    .select(SESSION_WITH_COACH_SELECT)
    .is("removed_at", null)
    .eq("profile_id", profileId)
    .order("session_at", { ascending: false, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as IndividualCoachingSessionWithCoach[]
}

export async function countIndividualCoachingSessions(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("individual_coaching_sessions")
    .select("id", { count: "exact", head: true })
    .is("removed_at", null)
    .eq("profile_id", profileId)

  if (error) throw error
  return count ?? 0
}

export async function listCoachProfiles(
  supabase: SupabaseClient<Database>,
): Promise<Pick<Profile, "id" | "name" | "picture">[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, picture")
    .eq("role", "coach")
    .is("access_removed_at", null)
    .order("name", { ascending: true })

  if (error) throw error
  return data ?? []
}

export interface TeamMemberCoachingStats {
  profile: { id: string; name: string; picture: string | null }
  count: number
}

export async function getTeamCoachingSessionStats(
  teamId: string,
): Promise<TeamMemberCoachingStats[]> {
  const admin = createAdminClient()

  const { data: members, error: memberError } = await admin
    .from("profiles")
    .select("id, name, picture")
    .eq("team_id", teamId)
    .is("access_removed_at", null)

  if (memberError) throw memberError
  if (!members || members.length === 0) return []

  const memberIds = members.map((m: { id: string }) => m.id)

  const { data: sessions, error: sessionError } = await admin
    .from("individual_coaching_sessions")
    .select("profile_id")
    .in("profile_id", memberIds)
    .is("removed_at", null)

  if (sessionError) throw sessionError

  const counts: Record<string, number> = {}
  for (const s of sessions ?? []) {
    counts[s.profile_id] = (counts[s.profile_id] ?? 0) + 1
  }

  return members.map((member: { id: string; name: string | null; picture: string | null }) => ({
    profile: {
      id: member.id,
      name: member.name ?? "",
      picture: member.picture,
    },
    count: counts[member.id] ?? 0,
  }))
}
