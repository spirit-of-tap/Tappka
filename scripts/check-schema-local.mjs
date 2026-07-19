#!/usr/bin/env node
/**
 * Local schema parity check: db/schema (via Drizzle snapshot) ↔ live DB ↔ db/sql.
 *
 * What it verifies:
 * 1. `db/schema/*.ts` matches the latest Drizzle snapshot (`drizzle-kit generate` no-op).
 * 2. Live local Postgres matches that snapshot (tables, columns, enums, views, policies, RLS).
 * 3. `db/sql/schema.sql` (refreshed via export) lists the same public schema objects.
 *
 * Note: `functions.sql` / `triggers.sql` are not modeled in `db/schema` — they are
 * dumped for inspection only. This check only asserts they were exported successfully.
 *
 * Usage: pnpm db:local-check
 * Requires: local Supabase on 54322, pg_dump on PATH.
 */

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");
const META_DIR = path.join(MIGRATIONS_DIR, "meta");
const JOURNAL_PATH = path.join(META_DIR, "_journal.json");
const SQL_DIR = path.join(ROOT, "db/sql");
const SCHEMA_SQL_PATH = path.join(SQL_DIR, "schema.sql");
const FUNCTIONS_SQL_PATH = path.join(SQL_DIR, "functions.sql");
const TRIGGERS_SQL_PATH = path.join(SQL_DIR, "triggers.sql");

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`Local schema check failed: ${message}`);
  process.exit(1);
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

/**
 * Drizzle snapshots often store public schema as "" rather than "public".
 * @param {{ schema?: string } | null | undefined} object
 * @returns {boolean}
 */
function isPublicSchema(object) {
  const schema = object?.schema;
  return schema === "public" || schema === "" || schema == null;
}

/**
 * @param {Iterable<string>} values
 * @returns {string[]}
 */
function sortedUnique(values) {
  return [...new Set(values)].sort();
}

/**
 * @param {string[]} expected
 * @param {string[]} actual
 * @param {string} label
 */
function assertSameSet(expected, actual, label) {
  const missing = expected.filter((value) => !actual.includes(value));
  const extra = actual.filter((value) => !expected.includes(value));

  if (missing.length > 0 || extra.length > 0) {
    const parts = [`${label} mismatch`];
    if (missing.length > 0) {
      parts.push(`missing: ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      parts.push(`extra: ${extra.join(", ")}`);
    }
    fail(parts.join("\n"));
  }
}

function assertSchemaMatchesSnapshot() {
  const before = run("git", ["status", "--porcelain", "--", "supabase/migrations", "db/schema"]);
  const backupDir = mkdtempSync(path.join(os.tmpdir(), "tappka-migrations-"));

  /**
   * `drizzle-kit generate` writes migration files when schema drifted.
   * Restore from a pre-check copy so a failed local-check never leaves junk
   * migrations (and never wipes unrelated WIP under supabase/migrations).
   */
  const restoreMigrationsTree = () => {
    try {
      rmSync(MIGRATIONS_DIR, { recursive: true, force: true });
      cpSync(backupDir, MIGRATIONS_DIR, { recursive: true });
    } catch {
      // Best-effort cleanup; the original failure message still matters more.
    }
  };

  try {
    cpSync(MIGRATIONS_DIR, backupDir, { recursive: true });

    const output = run("pnpm", ["exec", "drizzle-kit", "generate"]);
    if (!/No schema changes/i.test(output)) {
      restoreMigrationsTree();
      fail(`db/schema does not match Drizzle snapshots:\n${output}`);
    }
  } catch (error) {
    restoreMigrationsTree();
    if (error && typeof error === "object" && "message" in error) {
      // already a fail() exit in some paths
    }
    const stderr = error && typeof error === "object" && "stderr" in error ? error.stderr : "";
    fail(
      `drizzle-kit generate failed while checking db/schema${stderr ? `\n${stderr}` : ""}`,
    );
  } finally {
    rmSync(backupDir, { recursive: true, force: true });
  }

  const after = run("git", ["status", "--porcelain", "--", "supabase/migrations", "db/schema"]);
  if (after !== before) {
    fail("drizzle-kit generate mutated migrations/schema unexpectedly");
  }

  console.log("db/schema ↔ Drizzle snapshot OK");
}

function loadLatestSnapshot() {
  if (!existsSync(JOURNAL_PATH)) {
    fail(`missing ${path.relative(ROOT, JOURNAL_PATH)}`);
  }

  const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8"));
  const entries = journal.entries ?? [];
  if (entries.length === 0) {
    fail("Drizzle journal is empty");
  }

  const latest = entries[entries.length - 1];
  const versionMatch = /^(\d{14})_/.exec(`${latest.tag}_`);
  if (!versionMatch && !latest.tag.startsWith("0000_")) {
    fail(`cannot resolve snapshot for journal tag ${latest.tag}`);
  }

  const snapshotName = latest.tag.startsWith("0000_")
    ? "0000_snapshot.json"
    : `${versionMatch[1]}_snapshot.json`;
  const snapshotPath = path.join(META_DIR, snapshotName);

  if (!existsSync(snapshotPath)) {
    fail(`missing snapshot ${snapshotName}`);
  }

  return {
    tag: latest.tag,
    snapshot: JSON.parse(readFileSync(snapshotPath, "utf8")),
  };
}

/**
 * Normalize Drizzle PG types for comparison with information_schema / format_type.
 * @param {string} typeName
 * @returns {string}
 */
function normalizeType(typeName) {
  return typeName
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace("timestamp with time zone", "timestamptz")
    .replace("timestamp without time zone", "timestamp")
    .replace("time without time zone", "time")
    .replace("time with time zone", "timetz")
    .replace("double precision", "float8")
    .replace("character varying", "varchar")
    .replace(/^public\./, "");
}

/**
 * @param {import('pg').Client} client
 * @param {object} snapshot
 */
async function assertLiveDbMatchesSnapshot(client, snapshot) {
  const expectedTables = sortedUnique(
    Object.values(snapshot.tables ?? {})
      .filter((table) => isPublicSchema(table))
      .map((table) => table.name),
  );

  const { rows: liveTables } = await client.query(`
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relispartition
    order by c.relname
  `);
  assertSameSet(
    expectedTables,
    liveTables.map((row) => row.name),
    "tables",
  );

  const expectedViews = sortedUnique(
    Object.values(snapshot.views ?? {})
      .filter((view) => isPublicSchema(view))
      .map((view) => view.name),
  );
  const { rows: liveViews } = await client.query(`
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
    order by c.relname
  `);
  assertSameSet(
    expectedViews,
    liveViews.map((row) => row.name),
    "views",
  );

  const expectedEnums = Object.values(snapshot.enums ?? {}).filter((enumDef) =>
    isPublicSchema(enumDef),
  );

  for (const enumDef of expectedEnums) {
    const { rows } = await client.query(
      `
      select e.enumlabel as value
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      join pg_enum e on e.enumtypid = t.oid
      where n.nspname = 'public'
        and t.typname = $1
      order by e.enumsortorder
      `,
      [enumDef.name],
    );

    if (rows.length === 0) {
      fail(`enum public.${enumDef.name} missing from live DB`);
    }

    assertSameSet(
      enumDef.values,
      rows.map((row) => row.value),
      `enum ${enumDef.name} values`,
    );
  }

  const { rows: liveEnumNames } = await client.query(`
    select t.typname as name
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typtype = 'e'
    order by t.typname
  `);
  assertSameSet(
    sortedUnique(expectedEnums.map((enumDef) => enumDef.name)),
    liveEnumNames.map((row) => row.name),
    "enums",
  );

  for (const table of Object.values(snapshot.tables ?? {})) {
    if (!isPublicSchema(table)) {
      continue;
    }

    const expectedColumns = Object.values(table.columns ?? {});
    const { rows: liveColumns } = await client.query(
      `
      select
        a.attname as name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) as type,
        a.attnotnull as not_null
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = $1
        and a.attnum > 0
        and not a.attisdropped
      order by a.attnum
      `,
      [table.name],
    );

    assertSameSet(
      sortedUnique(expectedColumns.map((column) => column.name)),
      sortedUnique(liveColumns.map((column) => column.name)),
      `columns on ${table.name}`,
    );

    const liveByName = Object.fromEntries(
      liveColumns.map((column) => [column.name, column]),
    );

    for (const column of expectedColumns) {
      const live = liveByName[column.name];
      if (!live) {
        continue;
      }

      if (Boolean(column.notNull) !== Boolean(live.not_null)) {
        fail(
          `column ${table.name}.${column.name} nullability mismatch ` +
            `(schema notNull=${Boolean(column.notNull)}, live notNull=${Boolean(live.not_null)})`,
        );
      }

      const expectedType = normalizeType(column.type);
      const liveType = normalizeType(live.type);
      // Allow varchar/text and numeric precision differences that format_type expands.
      const typesCompatible =
        expectedType === liveType ||
        liveType.startsWith(`${expectedType}(`) ||
        expectedType.startsWith(`${liveType}(`) ||
        (expectedType === "numeric" && liveType.startsWith("numeric")) ||
        (expectedType.startsWith("numeric") && liveType.startsWith("numeric"));

      if (!typesCompatible) {
        fail(
          `column ${table.name}.${column.name} type mismatch ` +
            `(schema=${column.type}, live=${live.type})`,
        );
      }
    }

    const { rows: rlsRows } = await client.query(
      `
      select c.relrowsecurity as enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = $1
      `,
      [table.name],
    );
    const liveRls = Boolean(rlsRows[0]?.enabled);
    const expectedRls = Boolean(table.isRLSEnabled);
    if (liveRls !== expectedRls) {
      fail(
        `RLS on ${table.name} mismatch (schema=${expectedRls}, live=${liveRls})`,
      );
    }

    const expectedPolicies = sortedUnique(
      Object.values(table.policies ?? {}).map((policy) => policy.name),
    );
    const { rows: livePolicies } = await client.query(
      `
      select policyname as name
      from pg_policies
      where schemaname = 'public'
        and tablename = $1
      order by policyname
      `,
      [table.name],
    );
    assertSameSet(
      expectedPolicies,
      livePolicies.map((row) => row.name),
      `policies on ${table.name}`,
    );
  }

  console.log("live DB ↔ Drizzle snapshot OK");
}

/**
 * @param {object} snapshot
 */
function assertSchemaSqlMatchesSnapshot(snapshot) {
  if (!existsSync(SCHEMA_SQL_PATH)) {
    fail("db/sql/schema.sql missing — export failed");
  }

  const schemaSql = readFileSync(SCHEMA_SQL_PATH, "utf8");

  const tablesInSql = sortedUnique(
    [...schemaSql.matchAll(/^CREATE TABLE public\.(\w+)/gm)].map(
      (match) => match[1],
    ),
  );
  const expectedTables = sortedUnique(
    Object.values(snapshot.tables ?? {})
      .filter((table) => isPublicSchema(table))
      .map((table) => table.name),
  );
  assertSameSet(expectedTables, tablesInSql, "db/sql/schema.sql tables");

  const enumsInSql = sortedUnique(
    [...schemaSql.matchAll(/^CREATE TYPE public\.(\w+) AS ENUM/gm)].map(
      (match) => match[1],
    ),
  );
  const expectedEnums = sortedUnique(
    Object.values(snapshot.enums ?? {})
      .filter((enumDef) => isPublicSchema(enumDef))
      .map((enumDef) => enumDef.name),
  );
  assertSameSet(expectedEnums, enumsInSql, "db/sql/schema.sql enums");

  const viewsInSql = sortedUnique(
    [
      ...schemaSql.matchAll(/^CREATE(?: OR REPLACE)? VIEW public\.(\w+)/gm),
    ].map((match) => match[1]),
  );
  const expectedViews = sortedUnique(
    Object.values(snapshot.views ?? {})
      .filter((view) => isPublicSchema(view))
      .map((view) => view.name),
  );
  assertSameSet(expectedViews, viewsInSql, "db/sql/schema.sql views");

  const policiesInSql = sortedUnique(
    [...schemaSql.matchAll(/^CREATE POLICY "([^"]+)"/gm)].map(
      (match) => match[1],
    ),
  );
  const expectedPolicies = sortedUnique(
    Object.values(snapshot.tables ?? {}).flatMap((table) =>
      Object.values(table.policies ?? {}).map((policy) => policy.name),
    ),
  );
  assertSameSet(expectedPolicies, policiesInSql, "db/sql/schema.sql policies");

  if (!existsSync(FUNCTIONS_SQL_PATH) || !existsSync(TRIGGERS_SQL_PATH)) {
    fail("db/sql/functions.sql or triggers.sql missing after export");
  }

  const functionsSql = readFileSync(FUNCTIONS_SQL_PATH, "utf8");
  const triggersSql = readFileSync(TRIGGERS_SQL_PATH, "utf8");
  if (!/Count:\s*\d+/.test(functionsSql) || !/Count:\s*\d+/.test(triggersSql)) {
    fail("functions.sql / triggers.sql look incomplete after export");
  }

  console.log("db/sql/schema.sql ↔ Drizzle snapshot OK");
  console.log(
    "db/sql/functions.sql + triggers.sql exported (not modeled in db/schema)",
  );
}

async function main() {
  assertSchemaMatchesSnapshot();

  const { tag, snapshot } = loadLatestSnapshot();
  console.log(`Using snapshot from ${tag}`);

  const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.SUPABASE_DB_URL ??
    DEFAULT_DATABASE_URL;

  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();
  } catch (error) {
    fail(
      "could not connect to local Supabase Postgres.\n" +
        "Start it with `pnpm supabase:start` (or `pnpm dev`), then retry.\n" +
        `URL: ${databaseUrl}\n` +
        `${error instanceof Error ? error.message : error}`,
    );
  }

  try {
    await assertLiveDbMatchesSnapshot(client, snapshot);
  } finally {
    await client.end();
  }

  try {
    run("pnpm", ["db:export"]);
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? error.stderr : "";
    fail(`pnpm db:export failed${stderr ? `\n${stderr}` : ""}`);
  }

  assertSchemaSqlMatchesSnapshot(snapshot);
  console.log("Local schema check passed");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
