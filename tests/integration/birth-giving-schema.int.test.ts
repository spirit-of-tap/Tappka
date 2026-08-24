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

      await client.query(`
        drop table if exists public.birth_giving_team_members cascade;
        drop table if exists public.birth_giving_teams cascade;
        drop table if exists public.birth_giving_events cascade;
      `);
      for (const tableName of legacyTableNames) {
        await client.query(`create table public.${tableName} (stub integer)`);
      }
      await client.query("insert into public.birth_giving_assignments values (1)");

      const guardSql = readMigrationBySuffix("_assert_empty_birth_giving_legacy_tables.sql");
      await expect(client.query(guardSql)).rejects.toThrow(/requires empty legacy tables/i);
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
      const { rows } = await client.query<{ typname: string }>(
        `select typname
           from pg_type
          where typname like 'birth_giving_%'
            and typtype = 'e'
          order by typname`,
      );
      expect(rows.map((row) => row.typname)).toEqual([
        "birth_giving_assignment_state",
        "birth_giving_duration",
        "birth_giving_event_status",
        "birth_giving_team_result_state",
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
         ) values ('  Café　Launch  ', ' Město ', $1, '8h', 'draft', $2::uuid[], $2, $2)`,
        [startsAt, organizer.profileId],
      );

      await expectConstraintViolation(
        client,
        () => client.query(
          `insert into public.birth_giving_events (
             name, customer, starts_at, duration, status, organizer_profile_ids,
             created_by_profile_id, updated_by_profile_id
           ) values ('Café Launch', 'Město', $1, '8h', 'draft', $2::uuid[], $2, $2)`,
          [startsAt, organizer.profileId],
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
});
