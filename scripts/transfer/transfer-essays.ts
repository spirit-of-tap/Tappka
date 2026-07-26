import type { Tables } from "@/lib/supabase/database.types";

import { resolveSource, resolveTarget } from "./config";
import { assertTargetEmpty, formatPlan, gatherPlan } from "./preflight";
import { selectAll } from "./rest";
import { rollbackTransfer } from "./rollback";
import { transferCatalog } from "./stage-catalog";
import { transferEssays } from "./stage-essays";
import { collectAllObjectPaths, syncStorage } from "./stage-storage";
import { transferProfiles } from "./stage-profiles";
import { createMissingTeams } from "./stage-teams";
import { verifyTransfer } from "./verify";

const PRODUCTION_CONFIRM_FLAG = "--i-know-this-is-production";
const PRODUCTION_TARGET = "production";

export interface CliOptions {
  readonly target: string;
  readonly dryRun: boolean;
  readonly resume: boolean;
  readonly rollback: boolean;
  readonly confirmProduction: boolean;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const targetArg = argv.find((arg) => arg.startsWith("--target="));
  if (targetArg === undefined) {
    throw new Error("Missing --target=preview|production");
  }
  return {
    target: targetArg.slice("--target=".length),
    dryRun: argv.includes("--dry-run"),
    resume: argv.includes("--resume"),
    rollback: argv.includes("--rollback"),
    confirmProduction: argv.includes(PRODUCTION_CONFIRM_FLAG),
  };
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  // Guard BEFORE resolving credentials, so the refusal is about production
  // rather than about a missing env var.
  if (options.target === PRODUCTION_TARGET && !options.confirmProduction) {
    throw new Error(`Refusing to touch production without ${PRODUCTION_CONFIRM_FLAG}`);
  }

  const source = resolveSource();
  const target = resolveTarget(options.target);

  section(`Preflight: local -> ${target.name}`);
  const plan = await gatherPlan(source, target);
  console.log(formatPlan(plan));

  if (options.rollback) {
    section("Rollback");
    await rollbackTransfer(source, target, plan);
    console.log("\nRollback complete.");
    return;
  }

  if (options.dryRun) {
    console.log("\nDry run — nothing was written.");
    return;
  }

  assertTargetEmpty(plan.targetCounts, options.resume);

  section("Teams");
  const teams = await createMissingTeams(target, plan);
  console.log(
    `  created ${teams.created}, matched by id ${teams.matchedById}, matched by name ${teams.matchedByName}`,
  );

  section("Profiles");
  const profiles = await transferProfiles(target, plan);
  console.log(`  inserted ${profiles.inserted}, team_id patched ${profiles.teamPatched}`);

  section("Catalog");
  const catalog = await transferCatalog(source, target, plan);
  console.log(`  books ${catalog.books}, tags ${catalog.tags}, book_tags ${catalog.bookTags}`);

  section("Revisions load");
  const revisions = await selectAll<Tables<"essay_revisions">>(source, "essay_revisions");
  console.log(`  loaded ${revisions.length} revisions`);

  section("Storage");
  const objectPaths = collectAllObjectPaths(revisions, source.publicImagePrefix);
  const storage = await syncStorage(source, target, objectPaths);
  console.log(
    `  referenced ${storage.referenced}, already present ${storage.alreadyPresent}, uploaded ${storage.uploaded}`,
  );

  section("Essays");
  const essays = await transferEssays(source, target, plan, revisions);
  console.log(
    `  essays ${essays.essays}, revisions ${essays.revisions} (${essays.rewrittenUrls} urls rewritten), comments ${essays.comments}`,
  );

  section("Verification");
  const checks = await verifyTransfer(source, target, plan);
  for (const check of checks) {
    console.log(`  ${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }

  const failures = checks.filter((check) => !check.passed);
  if (failures.length > 0) {
    throw new Error(`${failures.length} verification check(s) failed`);
  }
  console.log("\nTransfer verified.");
}

main().catch((error: unknown) => {
  console.error(`\nFATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
