import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";

import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import { withRollback } from "@/tests/setup/tx";

const CALENDAR_ID = "alfa@group.calendar.google.com";

async function insertMember(client: PoolClient, name: string, teamId: string | null, role: "student" | "coach" = "student") {
  const auth = await insertAuthUser(client);
  const { rows: userRows } = await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where auth_user_id = $1 returning id",
    [auth.id],
  );
  const { rows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ($1, $2, $3, $4, $5) returning id`,
    [name, `cal-${name.toLowerCase()}-${auth.id.slice(0, 8)}@studenti.czu.cz`, userRows[0].id, teamId, role],
  );
  return { profileId: rows[0].id as string, authId: auth.id };
}

async function seed(client: PoolClient) {
  const { rows } = await client.query("insert into public.teams (name) values ('Cal A'), ('Cal B') returning id");
  const teamId = rows[0].id as string;
  const otherTeamId = rows[1].id as string;
  const member = await insertMember(client, "Member", teamId);
  const { rows: sessionRows } = await client.query(
    `insert into public.training_sessions (team_id, topic, starts_at, ends_at, created_by_profile_id, updated_by_profile_id)
     values ($1, 'Vyjednávání', now() + interval '1 day', now() + interval '1 day 3 hours', $2, $2) returning id`,
    [teamId, member.profileId],
  );
  // Sync state is written by the service role only; seed it before switching to user claims.
  await client.query(
    "insert into public.training_session_calendar_events (training_session_id, team_id, status, error_message) values ($1, $2, 'failed', 'x')",
    [sessionRows[0].id, teamId],
  );
  return {
    teamId,
    otherTeamId,
    sessionId: sessionRows[0].id as string,
    member,
    outsider: await insertMember(client, "Outsider", otherTeamId),
    coach: await insertMember(client, "Coach", null, "coach"),
  };
}

function connect(client: PoolClient, teamId: string, profileId: string) {
  return client.query(
    "insert into public.team_google_calendars (team_id, calendar_id, calendar_name, connected_by_profile_id) values ($1, $2, 'Tým', $3)",
    [teamId, CALENDAR_ID, profileId],
  );
}

describe("team_google_calendars RLS", () => {
  it("lets team members connect, see and disconnect their own team's calendar", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.member.authId });
      await connect(client, s.teamId, s.member.profileId);
      const { rows } = await client.query("select calendar_id from public.team_google_calendars where team_id = $1", [s.teamId]);
      expect(rows).toEqual([{ calendar_id: CALENDAR_ID }]);
      const { rowCount } = await client.query("delete from public.team_google_calendars where team_id = $1", [s.teamId]);
      expect(rowCount).toBe(1);
    });
  });

  it("blocks other teams from connecting it", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.outsider.authId });
      await expect(connect(client, s.teamId, s.outsider.profileId)).rejects.toThrow(/row-level security/);
    });
  });

  it("hides it from other teams", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.member.authId });
      await connect(client, s.teamId, s.member.profileId);
      await asClaims(client, { sub: s.outsider.authId });
      const { rows } = await client.query("select 1 from public.team_google_calendars where team_id = $1", [s.teamId]);
      expect(rows).toHaveLength(0);
    });
  });

  it("lets coaches manage any team's calendar", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.coach.authId });
      await connect(client, s.otherTeamId, s.coach.profileId);
      const { rowCount } = await client.query(
        "update public.team_google_calendars set calendar_name = 'Nový' where team_id = $1",
        [s.otherTeamId],
      );
      expect(rowCount).toBe(1);
    });
  });
});

describe("training_session_calendar_events RLS", () => {
  it("is readable by the team and coaches, hidden from other teams, and never writable by users", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      const select = "select status from public.training_session_calendar_events where training_session_id = $1";

      await asClaims(client, { sub: s.member.authId });
      expect((await client.query(select, [s.sessionId])).rows).toEqual([{ status: "failed" }]);
      const { rowCount } = await client.query(
        "update public.training_session_calendar_events set status = 'synced' where training_session_id = $1",
        [s.sessionId],
      );
      expect(rowCount).toBe(0);

      await asClaims(client, { sub: s.coach.authId });
      expect((await client.query(select, [s.sessionId])).rows).toHaveLength(1);

      await asClaims(client, { sub: s.outsider.authId });
      expect((await client.query(select, [s.sessionId])).rows).toHaveLength(0);
    });
  });
});
