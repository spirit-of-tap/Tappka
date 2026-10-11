import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

import type { TeamOption } from "./team-select"

/** Roles that may look at any team's time (others see only their own team). */
export const TEAM_WIDE_ROLES: readonly string[] = ["coach", "admin"]

export interface CasTeamContext {
  canPickTeam: boolean
  /** All active teams for coaches / admins; empty otherwise. */
  teams: TeamOption[]
  /** The team to show, or `null` (no team yet / no teams at all). */
  team: TeamOption | null
}

/** Which team the Tým / Reporting tabs show: `?team=` for coaches and admins, else the own team. */
export async function resolveCasTeam(
  supabase: SupabaseClient<Database>,
  profile: { role: string; team_id: string | null; team?: { name: string | null } | null },
  requestedTeamId: string | undefined,
): Promise<CasTeamContext> {
  const canPickTeam = TEAM_WIDE_ROLES.includes(profile.role)
  if (canPickTeam) {
    const { data, error } = await supabase
      .from("teams")
      .select("id, name")
      .is("removed_at", null)
      .order("name", { ascending: true })
    if (error) throw error
    const teams = data ?? []
    const team = teams.find((candidate) => candidate.id === requestedTeamId) ?? teams[0] ?? null
    return { canPickTeam, teams, team }
  }
  const team = profile.team_id ? { id: profile.team_id, name: profile.team?.name ?? "" } : null
  return { canPickTeam, teams: [], team }
}
