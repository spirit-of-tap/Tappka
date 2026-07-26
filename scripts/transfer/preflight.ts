import type { Tables } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import { buildProfileMap, type ProfileMap } from "./profile-map";
import { countRows, selectAll } from "./rest";
import { buildTeamMap, type TeamIdentity, type TeamMap } from "./team-map";

export const DATA_TABLES = [
  "books",
  "tags",
  "book_tags",
  "essays",
  "essay_revisions",
  "essay_comments",
] as const;

export type DataTable = (typeof DATA_TABLES)[number];

export type { TeamIdentity } from "./team-map";

export interface TransferPlan {
  readonly sourceProfiles: readonly Tables<"profiles">[];
  readonly targetProfiles: readonly Tables<"profiles">[];
  readonly profileMap: ProfileMap;
  readonly sourceTeams: readonly Tables<"teams">[];
  readonly teamMap: TeamMap;
  readonly sourceCounts: Readonly<Record<DataTable, number>>;
  readonly targetCounts: Readonly<Record<DataTable, number>>;
}

export function assertTargetEmpty(
  counts: Readonly<Record<DataTable, number>>,
  resume: boolean,
): void {
  if (resume) return;

  const populated = DATA_TABLES.filter((table) => counts[table] > 0);
  if (populated.length === 0) return;

  const detail = populated.map((table) => `${table}=${counts[table]}`).join(", ");
  throw new Error(
    `Target already holds data (${detail}). Re-run with --resume to continue an interrupted transfer, or --rollback to clear it.`,
  );
}

async function countAll(
  endpoint: Endpoint,
): Promise<Record<DataTable, number>> {
  const entries = await Promise.all(
    DATA_TABLES.map(async (table) => [table, await countRows(endpoint, table)] as const),
  );
  return Object.fromEntries(entries) as Record<DataTable, number>;
}

export async function gatherPlan(source: Endpoint, target: Endpoint): Promise<TransferPlan> {
  const [sourceTeams, targetTeams] = await Promise.all([
    selectAll<Tables<"teams">>(source, "teams"),
    selectAll<TeamIdentity>(target, "teams", "id,name"),
  ]);
  const teamMap = buildTeamMap(sourceTeams, targetTeams);

  const [sourceProfiles, targetProfiles] = await Promise.all([
    selectAll<Tables<"profiles">>(source, "profiles"),
    selectAll<Tables<"profiles">>(target, "profiles"),
  ]);

  const [sourceCounts, targetCounts] = await Promise.all([
    countAll(source),
    countAll(target),
  ]);

  return {
    sourceProfiles,
    targetProfiles,
    profileMap: buildProfileMap(sourceProfiles, targetProfiles),
    sourceTeams,
    teamMap,
    sourceCounts,
    targetCounts,
  };
}

export function formatPlan(plan: TransferPlan): string {
  const lines: string[] = [];

  lines.push("profiles:");
  lines.push(`  source ${plan.sourceProfiles.length}, target ${plan.targetProfiles.length}`);
  lines.push(`  insert ${plan.profileMap.insertIds.size}, reuse ${plan.profileMap.collisions.length}`);
  for (const collision of plan.profileMap.collisions) {
    lines.push(`    reuse ${collision.workEmail}: ${collision.sourceId} -> ${collision.targetId}`);
  }

  lines.push("teams:");
  lines.push(
    `  matched by id ${plan.teamMap.matchedById.length}, matched by name ${plan.teamMap.matchedByName.length}, to create ${plan.teamMap.missing.length}`,
  );
  for (const match of plan.teamMap.matchedByName) {
    lines.push(`    match "${match.name}": ${match.sourceId} -> ${match.targetId}`);
  }
  for (const team of plan.teamMap.missing) {
    lines.push(`    create "${team.name}" (${team.id})`);
  }

  lines.push("tables:");
  for (const table of DATA_TABLES) {
    lines.push(`  ${table}: source ${plan.sourceCounts[table]}, target ${plan.targetCounts[table]}`);
  }

  return lines.join("\n");
}
