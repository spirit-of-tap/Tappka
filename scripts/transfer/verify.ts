import type { Tables } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import { DATA_TABLES, type DataTable, type TransferPlan } from "./preflight";
import { countRows, selectAll } from "./rest";
import { headObject } from "./storage";

const LOCALHOST_MARKER = "127.0.0.1";
const IMAGE_SAMPLE_SIZE = 25;
const EARLIEST_FIRST = "order=created_at.asc&limit=1";

export interface Check {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export function compareCounts(
  sourceCounts: Readonly<Record<DataTable, number>>,
  targetCounts: Readonly<Record<DataTable, number>>,
): Check[] {
  return DATA_TABLES.map((table) => ({
    name: `count:${table}`,
    passed: sourceCounts[table] === targetCounts[table],
    detail: `source ${sourceCounts[table]}, target ${targetCounts[table]}`,
  }));
}

function collectTargetImagePaths(
  revisions: readonly Pick<Tables<"essay_revisions">, "content_json">[],
  publicImagePrefix: string,
): string[] {
  const prefix = `${publicImagePrefix}/`;
  const paths = new Set<string>();

  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      if (value.startsWith(prefix)) paths.add(decodeURIComponent(value.slice(prefix.length)));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value !== null && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };

  revisions.forEach((revision) => walk(revision.content_json));
  return [...paths];
}

export async function verifyTransfer(
  source: Endpoint,
  target: Endpoint,
  plan: TransferPlan,
): Promise<Check[]> {
  const checks: Check[] = [];

  const targetCountEntries = await Promise.all(
    DATA_TABLES.map(async (table) => [table, await countRows(target, table)] as const),
  );
  const targetCounts = Object.fromEntries(targetCountEntries) as Record<DataTable, number>;
  checks.push(...compareCounts(plan.sourceCounts, targetCounts));

  const targetProfileCount = await countRows(target, "profiles");
  checks.push({
    name: "count:profiles",
    passed: targetProfileCount === plan.sourceProfiles.length,
    detail: `source ${plan.sourceProfiles.length}, target ${targetProfileCount}`,
  });

  const [sourceTeams, targetTeams] = await Promise.all([
    selectAll<{ id: string }>(source, "teams", "id"),
    selectAll<{ id: string }>(target, "teams", "id"),
  ]);
  checks.push({
    name: "teams:unchanged",
    passed: targetTeams.length === sourceTeams.length,
    detail: `source ${sourceTeams.length}, target ${targetTeams.length}`,
  });

  // Reused profiles must keep the role and user_id they had before the run (R3).
  const currentProfiles = await selectAll<Tables<"profiles">>(target, "profiles");
  for (const collision of plan.profileMap.collisions) {
    const before = plan.targetProfiles.find((p) => p.id === collision.targetId);
    const after = currentProfiles.find((p) => p.id === collision.targetId);
    checks.push({
      name: `profile:preserved:${collision.workEmail}`,
      passed: after?.role === before?.role && after?.user_id === before?.user_id,
      detail: `role ${before?.role} -> ${after?.role}, user_id ${before?.user_id} -> ${after?.user_id}`,
    });
  }

  // Chronology survived the transfer (R1) — the direct guard on timestamps.
  const [targetEarliest, sourceEarliest] = await Promise.all([
    selectAll<Pick<Tables<"essays">, "created_at">>(target, "essays", "created_at", EARLIEST_FIRST),
    selectAll<Pick<Tables<"essays">, "created_at">>(source, "essays", "created_at", EARLIEST_FIRST),
  ]);
  checks.push({
    name: "essays:earliest-created_at",
    passed: targetEarliest[0]?.created_at === sourceEarliest[0]?.created_at,
    detail: `source ${sourceEarliest[0]?.created_at}, target ${targetEarliest[0]?.created_at}`,
  });

  const targetRevisions = await selectAll<Pick<Tables<"essay_revisions">, "content_json">>(
    target,
    "essay_revisions",
    "content_json",
  );

  // No local URL may survive in the target (R5). Scanned in JS rather than with a
  // PostgREST filter: `like` cannot be applied to a jsonb column, so
  // `content_json=like.*…*` errors out instead of matching.
  const leaked = targetRevisions.filter((revision) =>
    JSON.stringify(revision.content_json).includes(LOCALHOST_MARKER),
  );
  checks.push({
    name: "content_json:no-localhost",
    passed: leaked.length === 0,
    detail: `${leaked.length} of ${targetRevisions.length} revisions reference ${LOCALHOST_MARKER}`,
  });

  // A sample of rewritten image URLs must actually resolve in the target.
  const sample = collectTargetImagePaths(targetRevisions, target.publicImagePrefix).slice(
    0,
    IMAGE_SAMPLE_SIZE,
  );
  const heads = await Promise.all(sample.map((path) => headObject(target, path)));
  const missing = heads.filter((head) => !head.exists).length;
  checks.push({
    name: "storage:sample-resolves",
    passed: missing === 0,
    detail: `${sample.length - missing}/${sample.length} sampled images resolve`,
  });

  return checks;
}
