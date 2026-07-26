import type { TablesInsert } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import type { TransferPlan } from "./preflight";
import { insertRows } from "./rest";

export interface TeamStageReport {
  readonly created: number;
  readonly matchedById: number;
  readonly matchedByName: number;
}

/**
 * Creates only the source teams that have no target counterpart, keeping their
 * source id so `profiles.team_id` resolves without further mapping. Teams that
 * already exist — whether matched by id or by name — are never modified, so a
 * live environment's own team records stay authoritative.
 */
export async function createMissingTeams(
  target: Endpoint,
  plan: TransferPlan,
): Promise<TeamStageReport> {
  const missingIds = new Set(plan.teamMap.missing.map((team) => team.id));
  const rows: TablesInsert<"teams">[] = plan.sourceTeams.filter((team) =>
    missingIds.has(team.id),
  );

  await insertRows(target, "teams", rows);

  return {
    created: rows.length,
    matchedById: plan.teamMap.matchedById.length,
    matchedByName: plan.teamMap.matchedByName.length,
  };
}
