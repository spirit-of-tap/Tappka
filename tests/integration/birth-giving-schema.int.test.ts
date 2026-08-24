import type { PoolClient } from "pg";
import { describe, expect, it } from "vitest";

import { insertVerifiedProfile } from "@/tests/setup/factories";
import { readMigrationBySuffix } from "@/tests/setup/testdb";
import { withRollback } from "@/tests/setup/tx";

const FUTURE_OFFSET_MS = 30 * 24 * 60 * 60 * 1_000;

function futureTimestamp(): string {
  return new Date(Date.now() + FUTURE_OFFSET_MS).toISOString();
}

async function expectConstraintViolation(
  client: PoolClient,
  operation: () => Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  await client.query("savepoint expected_constraint_violation");
  try {
    await operation();
    throw new Error("Expected database constraint violation");
  } catch (error: unknown) {
    await client.query("rollback to savepoint expected_constraint_violation");
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(pattern);
  } finally {
    await client.query("release savepoint expected_constraint_violation");
  }
}

async function insertEvent(
  client: PoolClient,
  profileId: string,
  suffix: string,
  startsAt = futureTimestamp(),
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.birth_giving_events (
       name,
       customer,
       starts_at,
       duration,
       status,
       organizer_profile_ids,
       created_by_profile_id,
       updated_by_profile_id
     ) values ($1, 'Customer', $2, '8h', 'draft', $3::uuid[], $4, $4)
     returning id`,
    [`Event ${suffix}`, startsAt, [profileId], profileId],
  );
  return rows[0].id;
}

async function insertTeam(
  client: PoolClient,
  eventId: string,
  profileId: string,
  name: string,
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.birth_giving_teams (
       event_id,
       name,
       created_by_profile_id,
       updated_by_profile_id
     ) values ($1, $2, $3, $3)
     returning id`,
    [eventId, name, profileId],
  );
  return rows[0].id;
}

describe("Birth Giving simplification migration", () => {
  it("aborts before dropping non-empty legacy tables", async () => {
    await withRollback(async (client) => {
      const legacyTableNames = [
        "birth_giving_assignments",
        "birth_giving_email_deliveries",
        "birth_giving_event_organizers",
        "birth_giving_events",
        "birth_giving_looking_for_team",
        "birth_giving_reflections",
        "birth_giving_storage_cleanup_claims",
        "birth_giving_team_members",
        "birth_giving_team_proposals",
        "birth_giving_team_result_files",
        "birth_giving_teams",
      ] as const;

      // Clear any legacy table still present (e.g. if the full chain is not
      // applied) inside the rollback transaction so the stubs below are safe
      // to create; nothing is dropped out of band.
      for (const tableName of legacyTableNames) {
        await client.query(`drop table if exists public.${tableName} cascade`);
      }
      for (const tableName of legacyTableNames) {
        await client.query(`create table public.${tableName} (stub integer)`);
      }
      await client.query("insert into public.birth_giving_assignments values (1)");

      // The emptiness guard lives at the top of the drop migration, so it must
      // run in the same file/transaction as the destructive drops.
      const guardSql = readMigrationBySuffix("_drop_legacy_birth_giving_tables.sql");
      await expect(client.query(guardSql)).rejects.toThrow(/requires empty legacy tables/i);
    });
  });

  it("keeps only the secure Birth Giving mutation functions after retirement", async () => {
    await withRollback(async (client) => {
      const { rows } = await client.query<{ proname: string }>(
        `select p.proname
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and (
              substring(p.proname for 12) = 'birth_giving'
              or p.proname = 'can_view_birth_giving_event_organizers'
            )
          order by p.proname`,
      );
      expect(rows.map((row) => row.proname)).toEqual([
        "birth_giving_active_profile_id",
        "birth_giving_publish_event",
        "birth_giving_remove_event",
        "birth_giving_save_event",
      ]);
    });
  });

  it("leaves only the three current tables with RLS enabled", async () => {
    await withRollback(async (client) => {
      const { rows } = await client.query<{ relname: string; relrowsecurity: boolean }>(
        `select c.relname, c.relrowsecurity
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relkind = 'r'
            and c.relname like 'birth_giving_%'
          order by c.relname`,
      );
      expect(rows).toEqual([
        { relname: "birth_giving_events", relrowsecurity: true },
        { relname: "birth_giving_team_members", relrowsecurity: true },
        { relname: "birth_giving_teams", relrowsecurity: true },
      ]);
    });
  });

  it("keeps only enums that validate the current model", async () => {
    await withRollback(async (client) => {
      const { rows } = await client.query<{ typname: string; labels: string }>(
        `select t.typname,
                string_agg(e.enumlabel, ',' order by e.enumsortorder) as labels
           from pg_type t
           join pg_enum e on e.enumtypid = t.oid
          where t.typname like 'birth_giving_%'
            and t.typtype = 'e'
          group by t.typname
          order by t.typname`,
      );
      expect(rows).toEqual([
        {
          typname: "birth_giving_assignment_state",
          labels: "present,missing,none",
        },
        { typname: "birth_giving_duration", labels: "8h,24h" },
        { typname: "birth_giving_event_status", labels: "draft,published" },
        {
          typname: "birth_giving_team_result_state",
          labels: "pending,present,missing",
        },
      ]);
    });
  });

  it("keeps the composite team key and the membership team foreign key", async () => {
    await withRollback(async (client) => {
      const { rows } = await client.query<{
        name: string;
        kind: string;
        columns: string;
        references: string;
      }>(
        `select
           c.conname as name,
           case c.contype when 'u' then 'unique' when 'f' then 'fk' end as kind,
           (select string_agg(a.attname, ',' order by o.ord)
              from unnest(c.conkey) with ordinality o(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = o.attnum) as columns,
           coalesce(
             (select string_agg(a.attname, ',' order by o.ord)
                from unnest(c.confkey) with ordinality o(attnum, ord)
                join pg_attribute a on a.attrelid = c.confrelid and a.attnum = o.attnum),
             ''
           ) as references
           from pg_constraint c
           join pg_class t on t.oid = c.conrelid
           join pg_namespace n on n.oid = t.relnamespace
          where n.nspname = 'public'
            and t.relname in ('birth_giving_teams', 'birth_giving_team_members')
            and c.conname in ('birth_giving_teams_event_id_id_key', 'birth_giving_team_members_event_team_fkey')
          order by c.conname`,
      );
      expect(rows).toEqual([
        {
          name: "birth_giving_team_members_event_team_fkey",
          kind: "fk",
          columns: "event_id,team_id",
          references: "event_id,id",
        },
        {
          name: "birth_giving_teams_event_id_id_key",
          kind: "unique",
          columns: "event_id,id",
          references: "",
        },
      ]);
    });
  });

  it("retires the legacy organizer helper and restores updated-at triggers", async () => {
    await withRollback(async (client) => {
      const { rows: routineRows } = await client.query<{ proname: string }>(
        `select p.proname
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'can_view_birth_giving_event_organizers'`,
      );
      expect(routineRows).toEqual([]);

      const { rows: triggerRows } = await client.query<{ tgname: string }>(
        `select t.tgname
           from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname in (
              'birth_giving_events',
              'birth_giving_team_members',
              'birth_giving_teams'
            )
            and not t.tgisinternal
          order by t.tgname`,
      );
      expect(triggerRows.map((row) => row.tgname)).toEqual([
        "birth_giving_events_updated_at_trigger",
        "birth_giving_team_members_updated_at_trigger",
        "birth_giving_teams_updated_at_trigger",
      ]);
    });
  });
});

describe("Birth Giving relational invariants", () => {
  it("rejects normalized duplicate event identities", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const startsAt = futureTimestamp();
      await client.query(
        `insert into public.birth_giving_events (
           name, customer, starts_at, duration, status, organizer_profile_ids,
           created_by_profile_id, updated_by_profile_id
         ) values ('  Café　Launch  ', ' Město ', $1, '8h', 'draft', $2::uuid[], $3, $3)`,
        [startsAt, [organizer.profileId], organizer.profileId],
      );

      await expectConstraintViolation(
        client,
        () => client.query(
          `insert into public.birth_giving_events (
             name, customer, starts_at, duration, status, organizer_profile_ids,
             created_by_profile_id, updated_by_profile_id
           ) values ('Café Launch', 'Město', $1, '8h', 'draft', $2::uuid[], $3, $3)`,
          [startsAt, [organizer.profileId], organizer.profileId],
        ),
        /unique|duplicate/i,
      );
    });
  });

  it("rejects a membership whose event and team do not match", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const firstEventId = await insertEvent(client, organizer.profileId, "first");
      const secondEventId = await insertEvent(client, organizer.profileId, "second");
      const firstTeamId = await insertTeam(client, firstEventId, organizer.profileId, "First team");

      await expectConstraintViolation(
        client,
        () => client.query(
          `insert into public.birth_giving_team_members (
             event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id
           ) values ($1, $2, $3, $4, $4)`,
          [secondEventId, firstTeamId, member.profileId, organizer.profileId],
        ),
        /foreign key/i,
      );
    });
  });

  it("allows at most one winning team per event", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "winner");
      const firstTeamId = await insertTeam(client, eventId, organizer.profileId, "First team");
      const secondTeamId = await insertTeam(client, eventId, organizer.profileId, "Second team");
      await client.query("update public.birth_giving_teams set is_winner = true where id = $1", [firstTeamId]);

      await expectConstraintViolation(
        client,
        () => client.query("update public.birth_giving_teams set is_winner = true where id = $1", [secondTeamId]),
        /unique|duplicate/i,
      );
    });
  });

  it("requires result state, result files, and reflection fields to stay consistent", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const member = await insertVerifiedProfile(client, { name: "Member" });
      const eventId = await insertEvent(client, organizer.profileId, "metadata");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Metadata team");

      await expectConstraintViolation(
        client,
        () => client.query(
          "update public.birth_giving_teams set result_state = 'present', result_files = '[]'::jsonb where id = $1",
          [teamId],
        ),
        /check/i,
      );

      await client.query(
        `insert into public.birth_giving_team_members (
           event_id, team_id, profile_id, created_by_profile_id, updated_by_profile_id
         ) values ($1, $2, $3, $4, $4)`,
        [eventId, teamId, member.profileId, organizer.profileId],
      );
      await expectConstraintViolation(
        client,
        () => client.query(
          `update public.birth_giving_team_members
              set reflection_contribution = 'Contribution'
            where event_id = $1 and profile_id = $2`,
          [eventId, member.profileId],
        ),
        /check/i,
      );
    });
  });

  it("rejects inconsistent assignment metadata, cancellation fields, and removal pairing", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });
      const eventId = await insertEvent(client, organizer.profileId, "consistency");
      const teamId = await insertTeam(client, eventId, organizer.profileId, "Consistency team");

      // 'present' requires every metadata column plus a path under the event prefix.
      await expectConstraintViolation(
        client,
        () => client.query(
          `update public.birth_giving_events
              set assignment_state = 'present',
                  assignment_storage_path = 'birth-giving/assignments/other/file.pdf',
                  assignment_file_name = 'file.pdf',
                  assignment_mime_type = 'application/pdf',
                  assignment_file_size = 1024,
                  assignment_uploaded_at = now(),
                  assignment_uploaded_by_profile_id = $1
            where id = $2`,
          [organizer.profileId, eventId],
        ),
        /check/i,
      );

      // 'none' and 'missing' require every metadata column to stay null.
      await expectConstraintViolation(
        client,
        () => client.query(
          `update public.birth_giving_events
              set assignment_state = 'none',
                  assignment_file_name = 'file.pdf'
            where id = $1`,
          [eventId],
        ),
        /check/i,
      );
      await expectConstraintViolation(
        client,
        () => client.query(
          `update public.birth_giving_events
              set assignment_state = 'missing',
                  assignment_storage_path = 'birth-giving/assignments/' || $1::text || '/file.pdf'
            where id = $1`,
          [eventId],
        ),
        /check/i,
      );

      // Cancellation fields are paired and the reason is non-empty.
      await expectConstraintViolation(
        client,
        () => client.query(
          "update public.birth_giving_teams set cancelled_at = now() where id = $1",
          [teamId],
        ),
        /check/i,
      );
      await expectConstraintViolation(
        client,
        () => client.query(
          "update public.birth_giving_teams set cancellation_reason = 'Zrušeno' where id = $1",
          [teamId],
        ),
        /check/i,
      );

      // Removal fields are paired too.
      await expectConstraintViolation(
        client,
        () => client.query(
          "update public.birth_giving_events set removed_at = now() where id = $1",
          [eventId],
        ),
        /check/i,
      );
    });
  });

  it("rejects an organizer array that contains a NULL element", async () => {
    await withRollback(async (client) => {
      const organizer = await insertVerifiedProfile(client, { name: "Organizer" });

      await expectConstraintViolation(
        client,
        () => client.query(
          `insert into public.birth_giving_events (
             name, customer, starts_at, duration, status, organizer_profile_ids,
             created_by_profile_id, updated_by_profile_id
           ) values ('Null organizer', 'Customer', $1, '8h', 'draft', $2::uuid[], $3, $3)`,
          [futureTimestamp(), [null], organizer.profileId],
        ),
        /check/i,
      );
    });
  });
});
