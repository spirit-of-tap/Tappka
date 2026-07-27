import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { CustomerMeeting } from "./types"

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
