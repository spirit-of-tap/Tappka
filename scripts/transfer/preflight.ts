import type { Tables } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import { buildProfileMap, type ProfileMap } from "./profile-map";
import { countRows, selectAll } from "./rest";

export const DATA_TABLES = [
  "books",
  "tags",
  "book_tags",
  "essays",
  "essay_revisions",
  "essay_comments",
] as const;

export type DataTable = (typeof DATA_TABLES)[number];

export interface TeamIdentity {
  readonly id: string;
  readonly name: string;
}

export interface TransferPlan {
  readonly sourceProfiles: readonly Tables<"profiles">[];
  readonly targetProfiles: readonly Tables<"profiles">[];
  readonly profileMap: ProfileMap;
  readonly sourceCounts: Readonly<Record<DataTable, number>>;
  readonly targetCounts: Readonly<Record<DataTable, number>>;
}

/**
 * Teams are never inserted (spec: preview already holds all 15 with identical
 * UUIDs). Any divergence means profile.team_id values would dangle, so abort.
 */
export function assertTeamsAligned(
  source: readonly TeamIdentity[],
  target: readonly TeamIdentity[],
): void {
  const targetById = new Map(target.map((team) => [team.id, team.name]));

  for (const team of source) {
    const targetName = targetById.get(team.id);
    if (targetName === undefined) {
      throw new Error(
        `Team ${team.id} ("${team.name}") is missing from the target. Teams are never inserted by this transfer — create it first, then re-run.`,
      );
    }
    if (targetName !== team.name) {
      throw new Error(
        `Team ${team.id} name mismatch: source "${team.name}" vs target "${targetName}". Refusing to transfer against divergent teams.`,
      );
    }
  }
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
    selectAll<TeamIdentity>(source, "teams", "id,name"),
    selectAll<TeamIdentity>(target, "teams", "id,name"),
  ]);
  assertTeamsAligned(sourceTeams, targetTeams);

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

  lines.push("tables:");
  for (const table of DATA_TABLES) {
    lines.push(`  ${table}: source ${plan.sourceCounts[table]}, target ${plan.targetCounts[table]}`);
  }

  return lines.join("\n");
}
