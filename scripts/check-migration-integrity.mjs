#!/usr/bin/env node
/**
 * Guards against Drizzle/Supabase migration drift.
 *
 * Checks:
 * 1. Every journal entry has a matching .sql file and meta snapshot.
 * 2. Every post-baseline Drizzle SQL migration is listed in the journal
 *    (orphaned SQL like noisy_medusa-without-journal cannot recur).
 * 3. On PRs / compares: existing migration SQL files are not modified or deleted.
 * 4. drizzle-kit check passes.
 * 5. drizzle-kit generate is a no-op (working tree stays clean under migrations/).
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");
const META_DIR = path.join(MIGRATIONS_DIR, "meta");
const JOURNAL_PATH = path.join(META_DIR, "_journal.json");

/** First migration managed by the Drizzle journal (see meta/_journal.json). */
const DRIZZLE_BASELINE_PREFIX = "20260612193007";

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`Migration integrity failed: ${message}`);
  process.exit(1);
}

/**
 * @param {string} fileName
 * @returns {string | null}
 */
function migrationVersion(fileName) {
  const match = /^(\d{14})_/.exec(fileName);
  return match?.[1] ?? null;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {string}
 */
function run(command, args) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function readJournal() {
  if (!existsSync(JOURNAL_PATH)) {
    fail(`missing ${path.relative(ROOT, JOURNAL_PATH)}`);
  }

  const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8"));

  if (!Array.isArray(journal.entries)) {
    fail("journal.entries must be an array");
  }

  return journal;
}

function assertJournalFilesystemParity() {
  const journal = readJournal();
  const tags = journal.entries.map((entry) => entry.tag);
  const tagSet = new Set(tags);

  if (tagSet.size !== tags.length) {
    fail("duplicate tags in meta/_journal.json");
  }

  for (const [index, entry] of journal.entries.entries()) {
    if (entry.idx !== index) {
      fail(`journal entry idx ${entry.idx} should be ${index} for ${entry.tag}`);
    }

    // Drizzle baseline snapshot tag (0000_*) has no matching supabase SQL file.
    if (entry.tag.startsWith("0000_")) {
      const snapshotPath = path.join(META_DIR, "0000_snapshot.json");
      if (!existsSync(snapshotPath)) {
        fail("missing meta/0000_snapshot.json for baseline journal entry");
      }
      continue;
    }

    const version = migrationVersion(`${entry.tag}.sql`);
    if (!version) {
      fail(`journal tag is not a 14-digit migration: ${entry.tag}`);
    }

    const sqlPath = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
    const snapshotPath = path.join(META_DIR, `${version}_snapshot.json`);

    if (!existsSync(sqlPath)) {
      fail(`journal references missing SQL file: ${entry.tag}.sql`);
    }

    if (!existsSync(snapshotPath)) {
      fail(`journal references missing snapshot: ${version}_snapshot.json`);
    }
  }

  const sqlFiles = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
  const snapshotFiles = readdirSync(META_DIR).filter(
    (name) => name.endsWith("_snapshot.json") && name !== "0000_snapshot.json",
  );

  for (const snapshotFile of snapshotFiles) {
    const version = migrationVersion(snapshotFile);
    if (!version) {
      fail(`unexpected snapshot name: ${snapshotFile}`);
    }

    const matchingTag = tags.find((tag) => tag.startsWith(`${version}_`));
    if (!matchingTag) {
      fail(`orphan snapshot ${snapshotFile} has no journal entry`);
    }
  }

  // Hand-authored SQL (storage buckets, auth triggers, etc.) may exist outside the
  // Drizzle journal. The failure mode we prevent is: SQL + no journal entry while a
  // snapshot claims the migration — which makes the next generate re-emit DDL.
  for (const fileName of sqlFiles) {
    const version = migrationVersion(fileName);
    if (!version || version < DRIZZLE_BASELINE_PREFIX) {
      continue;
    }

    const hasSnapshot = existsSync(path.join(META_DIR, `${version}_snapshot.json`));
    const tag = fileName.replace(/\.sql$/, "");
    if (hasSnapshot && !tagSet.has(tag)) {
      fail(
        `SQL migration ${fileName} has a snapshot but is missing from meta/_journal.json`,
      );
    }
  }

  console.log(`Journal parity OK (${journal.entries.length} entries)`);
}

function assertExistingMigrationsImmutable() {
  const base = process.env.MIGRATION_DIFF_BASE;
  if (!base) {
    console.log("Skipping immutability check (MIGRATION_DIFF_BASE unset)");
    return;
  }

  try {
    run("git", ["cat-file", "-t", base]);
  } catch {
    try {
      run("git", ["fetch", "--depth", "1", "origin", base]);
    } catch {
      console.log(`Skipping immutability check (base commit ${base} not available)`);
      return;
    }
  }

  let diff;
  try {
    diff = run("git", ["diff", "--name-status", `${base}...HEAD`, "--", "supabase/migrations"]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("no merge base")) {
      fail(`git diff against ${base} failed: ${message}`);
    }
    console.log(`No merge base for ${base}...HEAD, falling back to two-dot diff`);
    try {
      diff = run("git", ["diff", "--name-status", base, "HEAD", "--", "supabase/migrations"]);
    } catch (error2) {
      fail(`git diff against ${base} failed: ${error2 instanceof Error ? error2.message : error2}`);
    }
  }

  if (!diff) {
    console.log(`Immutability OK (no migration path changes vs ${base})`);
    return;
  }

  const violations = [];

  for (const line of diff.split("\n")) {
    const [status, ...rest] = line.split("\t");
    const filePath = rest.at(-1);
    if (!filePath?.endsWith(".sql")) {
      continue;
    }

    if (status.startsWith("M") || status.startsWith("D") || status.startsWith("R")) {
      violations.push(line);
    }
  }

  if (violations.length > 0) {
    fail(
      `existing migration SQL must not be modified/deleted/renamed vs ${base}:\n${violations.join("\n")}`,
    );
  }

  console.log(`Immutability OK vs ${base}`);
}

function assertDrizzleCheck() {
  try {
    run("pnpm", ["exec", "drizzle-kit", "check"]);
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? error.stderr : "";
    fail(`drizzle-kit check failed${stderr ? `\n${stderr}` : ""}`);
  }

  console.log("drizzle-kit check OK");
}

function assertGenerateNoOp() {
  const before = run("git", [
    "status",
    "--porcelain",
    "--",
    "supabase/migrations",
    "db/schema",
  ]);

  try {
    const output = run("pnpm", ["exec", "drizzle-kit", "generate"]);
    if (!/No schema changes/i.test(output)) {
      fail(`drizzle-kit generate was not a no-op:\n${output}`);
    }
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? error.stderr : "";
    fail(
      `drizzle-kit generate failed (rename prompts in CI usually mean journal/schema drift)${stderr ? `\n${stderr}` : ""}`,
    );
  }

  const after = run("git", [
    "status",
    "--porcelain",
    "--",
    "supabase/migrations",
    "db/schema",
  ]);

  if (after !== before) {
    fail(
      `generate changed migrations/schema unexpectedly:\nbefore:\n${before || "(clean)"}\nafter:\n${after || "(clean)"}`,
    );
  }

  console.log("drizzle-kit generate no-op OK");
}

assertJournalFilesystemParity();
assertExistingMigrationsImmutable();
assertDrizzleCheck();
assertGenerateNoOp();
console.log("Migration integrity passed");
