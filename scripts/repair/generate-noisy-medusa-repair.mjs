#!/usr/bin/env node
/**
 * Generates a production repair script from 20260718212747_noisy_medusa.sql.
 *
 * Every statement is carried over verbatim except:
 *  - 25 `ADD COLUMN ... NOT NULL` (no DEFAULT) -> add nullable, backfill, SET NOT NULL
 *  - drops/creates made idempotent so out-of-band drift doesn't abort the run
 */

import { readFileSync, writeFileSync } from "node:fs";

const SRC =
  "/Users/kulo/development/timii/Tappka/supabase/migrations/20260718212747_noisy_medusa.sql";
const OUT =
  process.argv[2] ??
  "/Users/kulo/development/timii/Tappka/scripts/repair/noisy-medusa-repair.sql";

/** Backfill source per `table.column`. `null` = use the fallback actor profile. */
const BACKFILL = {
  "book_comments.created_by_profile_id": "author_profile_id",
  "book_comments.updated_by_profile_id": "author_profile_id",
  "books.updated_by_profile_id": "created_by_profile_id",
  "dashboard_layouts.created_by_profile_id": "profile_id",
  "dashboard_layouts.updated_by_profile_id": "profile_id",
  "essay_coach_reads.created_by_profile_id": "coach_profile_id",
  "essay_coach_reads.updated_by_profile_id": "coach_profile_id",
  "essay_comments.created_by_profile_id": "author_profile_id",
  "essay_comments.updated_by_profile_id": "author_profile_id",
  "essay_views.created_by_profile_id": "viewer_profile_id",
  "essay_views.updated_by_profile_id": "viewer_profile_id",
  "essay_votes.created_by_profile_id": "voter_profile_id",
  "essay_votes.updated_by_profile_id": "voter_profile_id",
  "essays.created_by_profile_id": "author_profile_id",
  "essays.updated_by_profile_id": "author_profile_id",
  "feedback.created_by_profile_id": "author_profile_id",
  "feedback.updated_by_profile_id": "author_profile_id",
  "recurring_schedules.created_by_profile_id": "created_by",
  "recurring_schedules.updated_by_profile_id": "created_by",
  "reservations.created_by_profile_id": "owner_profile_id",
  "reservations.updated_by_profile_id": "owner_profile_id",
  "rooms.created_by_profile_id": null,
  "rooms.updated_by_profile_id": null,
  "schedule_breaks.updated_by_profile_id": "created_by_profile_id",
};

/** Enum column that needs a literal rather than a profile reference. */
const ENUM_BACKFILL = {
  "recurring_schedules.schedule_type": "'training_session'::public.schedule_type",
};

/**
 * Fallback actor: oldest admin profile, else oldest profile. Inlined as a scalar
 * subquery rather than held in a temp table -- the Supabase SQL editor runs
 * inside its own transaction, so an `ON COMMIT DROP` temp table vanishes partway
 * through the script ("relation _repair_actor does not exist"). `id` is the final
 * tiebreaker so the choice is deterministic.
 */
const ACTOR =
  "(SELECT id FROM public.profiles ORDER BY (role = 'admin') DESC, created_at, id LIMIT 1)";

const raw = readFileSync(SRC, "utf8");
const statements = raw
  .split("--> statement-breakpoint")
  .map((s) => s.trim().replace(/;$/, "").trim())
  .filter(Boolean);

/**
 * Tables this script drops. Anything else targeting one of them has to be
 * guarded on table existence: `DROP POLICY IF EXISTS ... ON t` still errors
 * when `t` itself is gone, which breaks re-runs and any partially applied
 * production state.
 */
const DROPPED_TABLES = new Set(
  statements
    .map((s) => /^DROP TABLE "(\w+)"/.exec(s)?.[1])
    .filter((t) => t !== undefined),
);

/** Table a statement targets, when it is one that would break on a dropped table. */
function fragileTarget(stmt) {
  const m =
    /^DROP POLICY "[^"]+" ON "(\w+)"/.exec(stmt) ??
    /^ALTER POLICY "[^"]+" ON "(\w+)"/.exec(stmt) ??
    /^ALTER TABLE "(\w+)" (ENABLE|DISABLE) ROW LEVEL SECURITY/.exec(stmt) ??
    /^ALTER TABLE "(\w+)" /.exec(stmt);
  const table = m?.[1];
  return table !== undefined && DROPPED_TABLES.has(table) ? table : null;
}

/** @param {string} s */
function colExists(table, column) {
  return `EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}')`;
}

/** @param {string} body */
function doBlock(body) {
  return `DO $repair$\nBEGIN\n${body}\nEND\n$repair$;`;
}

/** @param {string} stmt */
function transform(stmt) {
  let m;

  // Statements aimed at a table this script drops: skip once the table is gone.
  const fragile = fragileTarget(stmt);
  if (fragile !== null) {
    return doBlock(
      `  IF to_regclass('public.${fragile}') IS NOT NULL THEN\n    EXECUTE ${quote(stmt)};\n  END IF;`,
    );
  }

  // CREATE TYPE ... AS ENUM  ->  skip if the type already exists
  if ((m = /^CREATE TYPE "public"\."(\w+)" AS ENUM/.exec(stmt))) {
    return doBlock(
      `  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = '${m[1]}') THEN\n    EXECUTE ${quote(stmt)};\n  END IF;`,
    );
  }

  // CREATE TABLE -> IF NOT EXISTS
  if (/^CREATE TABLE "/.test(stmt)) {
    return `${stmt.replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS ")};`;
  }

  // RENAME COLUMN -> only when the old name is still there and the new one is not
  if (
    (m = /^ALTER TABLE "(\w+)" RENAME COLUMN "(\w+)" TO "([\w"]+)"$/.exec(stmt))
  ) {
    const [, table, from, to] = m;
    const target = to.replace(/"/g, "");
    return doBlock(
      `  IF ${colExists(table, from)} AND NOT ${colExists(table, target)} THEN\n    EXECUTE ${quote(stmt)};\n  END IF;`,
    );
  }

  // DROP CONSTRAINT -> IF EXISTS
  if (/DROP CONSTRAINT "/.test(stmt)) {
    return `${stmt.replace(/DROP CONSTRAINT /, "DROP CONSTRAINT IF EXISTS ")};`;
  }

  // DROP INDEX / VIEW / TABLE / TYPE / POLICY -> IF EXISTS
  if (/^DROP INDEX "/.test(stmt))
    return `${stmt.replace(/^DROP INDEX /, "DROP INDEX IF EXISTS ")};`;
  if (/^DROP VIEW "/.test(stmt))
    return `${stmt.replace(/^DROP VIEW /, "DROP VIEW IF EXISTS ")};`;
  if (/^DROP TABLE "/.test(stmt))
    return `${stmt.replace(/^DROP TABLE /, "DROP TABLE IF EXISTS ")};`;
  if (/^DROP TYPE "/.test(stmt))
    return `${stmt.replace(/^DROP TYPE /, "DROP TYPE IF EXISTS ")};`;
  if (/^DROP POLICY "/.test(stmt))
    return `${stmt.replace(/^DROP POLICY /, "DROP POLICY IF EXISTS ")};`;

  // DROP COLUMN -> IF EXISTS
  if (/DROP COLUMN "/.test(stmt)) {
    return `${stmt.replace(/DROP COLUMN /, "DROP COLUMN IF EXISTS ")};`;
  }

  // ADD COLUMN ... NOT NULL with no DEFAULT -> nullable, backfill, SET NOT NULL
  if (
    (m = /^ALTER TABLE "(\w+)" ADD COLUMN "(\w+)" (.+) NOT NULL$/.exec(stmt)) &&
    !/DEFAULT/.test(stmt)
  ) {
    const [, table, column, type] = m;
    const key = `${table}.${column}`;
    const head = [
      `-- was: ${stmt};  (NOT NULL, no DEFAULT -> unsafe on populated table)`,
      `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${type};`,
    ];
    const tail = `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET NOT NULL;`;

    if (key in ENUM_BACKFILL) {
      const update = `UPDATE "${table}" SET "${column}" = ${ENUM_BACKFILL[key]} WHERE "${column}" IS NULL;`;
      return [...head, update, tail].join("\n");
    }
    if (!(key in BACKFILL)) throw new Error(`no backfill mapping for ${key}`);

    const src = BACKFILL[key];
    if (src === null) {
      const update = `UPDATE "${table}" SET "${column}" = ${ACTOR} WHERE "${column}" IS NULL;`;
      return [...head, update, tail].join("\n");
    }

    // Some source columns (e.g. recurring_schedules.created_by) are dropped
    // later in this same script, so a re-run must fall back to the actor.
    const withSrc = `UPDATE "${table}" SET "${column}" = COALESCE("${src}", ${ACTOR}) WHERE "${column}" IS NULL`;
    const withoutSrc = `UPDATE "${table}" SET "${column}" = ${ACTOR} WHERE "${column}" IS NULL`;
    const guarded = doBlock(
      `  IF ${colExists(table, src)} THEN\n    EXECUTE ${quote(withSrc)};\n  ELSE\n    EXECUTE ${quote(withoutSrc)};\n  END IF;`,
    );
    return [...head, guarded, tail].join("\n");
  }

  // plain ADD COLUMN (nullable, or has DEFAULT) -> IF NOT EXISTS
  if (/^ALTER TABLE "\w+" ADD COLUMN "/.test(stmt)) {
    return `${stmt.replace(/ADD COLUMN /, "ADD COLUMN IF NOT EXISTS ")};`;
  }

  // ADD CONSTRAINT -> skip if a constraint of that name already exists
  if ((m = /^ALTER TABLE "(\w+)" ADD CONSTRAINT "([\w]+)"/.exec(stmt))) {
    const [, table, name] = m;
    return doBlock(
      `  IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = '${table}' AND c.conname = '${name}') THEN\n    EXECUTE ${quote(stmt)};\n  END IF;`,
    );
  }

  // CREATE INDEX -> IF NOT EXISTS
  if (/^CREATE INDEX "/.test(stmt))
    return `${stmt.replace(/^CREATE INDEX /, "CREATE INDEX IF NOT EXISTS ")};`;

  // CREATE POLICY -> drop first so it is re-runnable
  if ((m = /^CREATE POLICY "([^"]+)" ON "(\w+)"/.exec(stmt))) {
    const [, name, table] = m;
    return `DROP POLICY IF EXISTS "${name}" ON "${table}";\n${stmt};`;
  }

  // ALTER POLICY -> skip when the policy is absent
  if ((m = /^ALTER POLICY "([^"]+)" ON "(\w+)"/.exec(stmt))) {
    const [, name, table] = m;
    return doBlock(
      `  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = '${table}' AND policyname = '${name}') THEN\n    EXECUTE ${quote(stmt)};\n  END IF;`,
    );
  }

  // ENABLE/DISABLE RLS, ALTER COLUMN TYPE/DROP NOT NULL/DROP DEFAULT: already idempotent
  return `${stmt};`;
}

/** @param {string} s */
function quote(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

const body = statements.map(transform).join("\n");

const header = `-- ============================================================================
-- One-off production repair for 20260718212747_noisy_medusa.sql
--
-- GENERATED from that migration -- do NOT put this file in supabase/migrations/.
--
-- Why this exists: the migration contains 25 \`ADD COLUMN ... NOT NULL\` with no
-- DEFAULT. Those are no-ops on the empty local/preview DB they were generated
-- against, and hard 23502 errors on populated production tables. Because the CLI
-- runs each migration file in one transaction, the first such failure
-- (recurring_schedules.schedule_type) rolled back the whole file -- including the
-- \`profiles.removed_access -> access_removed_at\` rename, which is why the app
-- throws 42703.
--
-- This script applies the same end state safely (add nullable -> backfill ->
-- SET NOT NULL), then records the migration as applied so the next
-- \`supabase migration up\` skips it and proceeds to the 6 migrations after it.
--
-- RUN scripts/repair/noisy-medusa-preflight.sql FIRST and read its output.
-- It reports the rows that the DROP COLUMN / DROP TABLE statements will destroy.
-- ============================================================================

-- Prefer psql over the Supabase SQL editor for this:
--   psql "$PRODUCTION_DB_URL" -v ON_ERROR_STOP=1 -f noisy-medusa-repair.sql
-- The editor runs statements inside its own transaction and applies a statement
-- timeout, so the BEGIN/COMMIT below cannot guarantee all-or-nothing there.
BEGIN;

-- NOT NULL creator columns are backfilled from an existing owner/author column
-- where one exists, and otherwise from a fallback actor: the oldest admin
-- profile. rooms has no creator column at all, and
-- recurring_schedules.created_by / reservations.owner_profile_id /
-- schedule_breaks.created_by are all nullable.
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles) THEN
    RAISE EXCEPTION 'public.profiles is empty -- no fallback actor for NOT NULL creator columns';
  END IF;
END
$repair$;

-- ----------------------------------------------------------------------------
-- Guard: unrecoverable data loss.
--
-- The migration drops essays.title/content_json/content_text while creating
-- essay_revisions EMPTY -- it never copies the content across -- and it drops
-- four tables outright. Refuse to run while that data is only in public.
--
-- Each check passes when the table is empty OR the rows have been captured by
-- scripts/repair/noisy-medusa-snapshot.sql into the \`legacy\` schema. Run that
-- script first; it makes these drops reversible.
-- ----------------------------------------------------------------------------
DO $repair$
DECLARE
  n bigint;
  snap bigint;
  t text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'essays' AND column_name = 'content_json'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.essays' INTO n;
    IF n > 0 THEN
      IF to_regclass('legacy.essays_content') IS NULL THEN
        RAISE EXCEPTION
          'ABORTED: % row(s) in public.essays hold title/content_json/content_text, which this script drops, and essay_revisions is created empty -- the content is NOT migrated. Run scripts/repair/noisy-medusa-snapshot.sql first.', n;
      END IF;
      EXECUTE 'SELECT count(*) FROM legacy.essays_content' INTO snap;
      IF snap < n THEN
        RAISE EXCEPTION
          'ABORTED: legacy.essays_content holds % row(s) but public.essays has % -- the snapshot is stale. Re-run scripts/repair/noisy-medusa-snapshot.sql.', snap, n;
      END IF;
    END IF;
  END IF;

  FOREACH t IN ARRAY ARRAY['team_reading_lists', 'team_reading_list_books', 'cowork_participants', 'room_issues']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN
        IF to_regclass('legacy.' || t) IS NULL THEN
          RAISE EXCEPTION
            'ABORTED: table public.% holds % row(s) and this script drops it. Run scripts/repair/noisy-medusa-snapshot.sql first.', t, n;
        END IF;
        EXECUTE format('SELECT count(*) FROM legacy.%I', t) INTO snap;
        IF snap < n THEN
          RAISE EXCEPTION
            'ABORTED: legacy.% holds % row(s) but public.% has % -- the snapshot is stale. Re-run scripts/repair/noisy-medusa-snapshot.sql.', t, snap, t, n;
        END IF;
      END IF;
    END IF;
  END LOOP;
END
$repair$;

`;

const footer = `
-- ----------------------------------------------------------------------------
-- Prepare for 20260719161010_fix_rename_casts.sql, the next migration the CLI
-- will run. It does \`alter column created_by_profile_id set not null\` on
-- schedule_breaks (line 87) and recurring_schedules (line 71). noisy_medusa only
-- RENAMES schedule_breaks.created_by -> created_by_profile_id and never
-- backfills it, and the old column was nullable -- so that migration is the next
-- 23502 waiting to happen. Backfill it here.
-- ----------------------------------------------------------------------------
UPDATE "schedule_breaks"
SET "created_by_profile_id" = ${ACTOR}
WHERE "created_by_profile_id" IS NULL;

ALTER TABLE "schedule_breaks" ALTER COLUMN "created_by_profile_id" SET NOT NULL;

-- ----------------------------------------------------------------------------
-- Record the migration as applied so the CLI skips it next run.
-- (Equivalent to: supabase migration repair --status applied 20260718212747)
-- ----------------------------------------------------------------------------
DO $repair$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('20260718212747')
    ON CONFLICT DO NOTHING;
  END IF;
END
$repair$;

COMMIT;
`;

writeFileSync(OUT, header + body + footer);
console.log(`wrote ${OUT} (${statements.length} source statements)`);
