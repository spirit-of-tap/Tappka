import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import type {
  RocketCategoryWithItems,
  RocketHistoryEntry,
  RocketIndividualState,
  RocketTeamCheck,
} from "./types"

export async function listRocketContent(
  supabase: SupabaseClient<Database>,
): Promise<RocketCategoryWithItems[]> {
  const { data: categories, error: categoriesError } = await supabase
    .from("rocket_categories")
    .select("*")
    .eq("is_active", true)
    .order("order_index", { ascending: true })

  if (categoriesError) throw categoriesError

  const { data: items, error: itemsError } = await supabase
    .from("rocket_items")
    .select("*")
    .eq("is_active", true)
    .order("order_index", { ascending: true })

  if (itemsError) throw itemsError

  return (categories ?? []).map((category) => ({
    ...category,
    items: (items ?? []).filter((item) => item.category_id === category.id),
  }))
}

export async function listRocketIndividualStates(
  supabase: SupabaseClient<Database>,
  memberIds: string[],
): Promise<RocketIndividualState[]> {
  if (memberIds.length === 0) return []

  const { data, error } = await supabase
    .from("rocket_individual_states")
    .select("*")
    .in("profile_id", memberIds)

  if (error) throw error
  return data ?? []
}

export async function listRocketTeamChecks(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<RocketTeamCheck[]> {
  const { data, error } = await supabase
    .from("rocket_team_checks")
    .select("*")
    .eq("team_id", teamId)

  if (error) throw error
  return data ?? []
}

export async function listOwnRocketHistory(
  supabase: SupabaseClient<Database>,
  profileId: string,
  limit = 20,
): Promise<RocketHistoryEntry[]> {
  const { data, error } = await supabase
    .from("rocket_individual_history")
    .select(
      "id, item_id, is_checked, created_at, item:rocket_items!inner(text_cs, category:rocket_categories!inner(title))",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    isChecked: row.is_checked,
    createdAt: row.created_at,
    itemText: row.item?.text_cs ?? "",
    categoryTitle: row.item?.category?.title ?? "",
  }))
}

export async function setIndividualCheck(
  supabase: SupabaseClient<Database>,
  args: { itemId: string; profileId: string; isChecked: boolean },
): Promise<void> {
  const { error: stateError } = await supabase.from("rocket_individual_states").upsert(
    { item_id: args.itemId, profile_id: args.profileId, is_checked: args.isChecked },
    { onConflict: "item_id,profile_id" },
  )
  if (stateError) throw stateError

  const { error: historyError } = await supabase.from("rocket_individual_history").insert({
    item_id: args.itemId,
    profile_id: args.profileId,
    is_checked: args.isChecked,
    created_by_profile_id: args.profileId,
  })
  if (historyError) throw historyError
}

export async function setTeamCheck(
  supabase: SupabaseClient<Database>,
  args: { teamId: string; itemId: string; isChecked: boolean; profileId: string },
): Promise<void> {
  const { error: checkError } = await supabase.from("rocket_team_checks").upsert(
    {
      team_id: args.teamId,
      item_id: args.itemId,
      is_checked: args.isChecked,
      checked_by_profile_id: args.profileId,
    },
    { onConflict: "team_id,item_id" },
  )
  if (checkError) throw checkError

  const { error: historyError } = await supabase.from("rocket_team_history").insert({
    team_id: args.teamId,
    item_id: args.itemId,
    is_checked: args.isChecked,
    created_by_profile_id: args.profileId,
  })
  if (historyError) throw historyError
}
