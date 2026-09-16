import type { Tables } from "@/lib/supabase/tables"

export type RocketCategory = Tables<"rocket_categories">
export type RocketItem = Tables<"rocket_items">
export type RocketIndividualState = Tables<"rocket_individual_states">
export type RocketTeamCheck = Tables<"rocket_team_checks">
export type RocketIndividualHistory = Tables<"rocket_individual_history">
export type RocketTeamHistory = Tables<"rocket_team_history">

export interface RocketCategoryWithItems extends RocketCategory {
  items: RocketItem[]
}

export interface RocketHistoryEntry {
  id: string
  itemId: string
  isChecked: boolean
  createdAt: string
  itemText: string
  categoryTitle: string
}

export const ROCKET_INDIVIDUAL_UPDATED_EVENT = "individual_updated"
export const ROCKET_TEAM_UPDATED_EVENT = "team_updated"

export interface RocketIndividualBroadcast {
  item_id: string
  profile_id: string
  is_checked: boolean
}

export interface RocketTeamBroadcast {
  team_id: string
  item_id: string
  is_checked: boolean
  checked_by_profile_id: string | null
}

export function rocketTopic(teamId: string): string {
  return `team:${teamId}:rocket`
}
