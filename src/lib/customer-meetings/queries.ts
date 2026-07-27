import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { CustomerMeeting } from "./types"
import { createAdminClient } from "@/lib/supabase/admin"

export async function listCustomerMeetings(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<CustomerMeeting[]> {
  const { data, error } = await supabase
    .from("customer_meetings")
    .select("*")
    .is("removed_at", null)
    .eq("profile_id", profileId)
    .order("meeting_at", { ascending: false, nullsFirst: false })

  if (error) throw error
  return data ?? []
}

export async function countCustomerMeetings(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("customer_meetings")
    .select("id", { count: "exact", head: true })
    .is("removed_at", null)
    .eq("profile_id", profileId)

  if (error) throw error
  return count ?? 0
}

export async function getCustomerMeeting(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<CustomerMeeting | null> {
  const { data, error } = await supabase
    .from("customer_meetings")
    .select("*")
    .eq("id", id)
    .is("removed_at", null)
    .maybeSingle()

  if (error) throw error
  return data
}

export interface TeamMemberMeetingStats {
  profile: { id: string; name: string; picture: string | null }
  count: number
}

export async function getTeamCustomerMeetingsStats(
  teamId: string,
): Promise<TeamMemberMeetingStats[]> {
  const admin = createAdminClient()

  const { data: members, error: memberError } = await admin
    .from("profiles")
    .select("id, name, picture")
    .eq("team_id", teamId)
    .is("access_removed_at", null)

  if (memberError) throw memberError
  if (!members || members.length === 0) return []

  const memberIds = members.map((m: { id: string }) => m.id)

  const { data: meetings, error: meetingError } = await admin
    .from("customer_meetings")
    .select("profile_id")
    .in("profile_id", memberIds)
    .is("removed_at", null)

  if (meetingError) throw meetingError

  const counts: Record<string, number> = {}
  for (const m of meetings ?? []) {
    counts[m.profile_id] = (counts[m.profile_id] ?? 0) + 1
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
