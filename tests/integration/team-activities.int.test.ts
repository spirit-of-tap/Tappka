import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import type { PoolClient } from "pg";

async function seed(client: PoolClient) {
  const ownerAuth = await insertAuthUser(client);
  const teammateAuth = await insertAuthUser(client);
  const otherAuth = await insertAuthUser(client);

  const { rows: ownerUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [ownerAuth.id],
  );
  const { rows: teammateUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [teammateAuth.id],
  );
  const { rows: otherUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [otherAuth.id],
  );

  await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where id = any($1)",
    [[ownerUserRows[0].id, teammateUserRows[0].id, otherUserRows[0].id]],
  );

  const { rows: teamRows } = await client.query(
    "insert into public.teams (name) values ('Team A'), ('Team B') returning id",
  );
  const teamId = teamRows[0].id as string;
  const otherTeamId = teamRows[1].id as string;

  const { rows: ownerProfileRows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ('Owner', 'tad-owner@studenti.czu.cz', $1, $2, 'student')
     returning id`,
    [ownerUserRows[0].id, teamId],
  );
  const { rows: teammateProfileRows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ('Teammate', 'tad-team@studenti.czu.cz', $1, $2, 'student')
     returning id`,
    [teammateUserRows[0].id, teamId],
  );
  const { rows: otherProfileRows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ('Other', 'tad-other@studenti.czu.cz', $1, $2, 'student')
     returning id`,
    [otherUserRows[0].id, otherTeamId],
  );

  return {
    teamId,
    otherTeamId,
    ownerProfileId: ownerProfileRows[0].id as string,
    teammateProfileId: teammateProfileRows[0].id as string,
    otherProfileId: otherProfileRows[0].id as string,
    ownerAuthId: ownerAuth.id as string,
    teammateAuthId: teammateAuth.id as string,
    otherAuthId: otherAuth.id as string,
  };
}

async function insertActivity(
  client: PoolClient,
  teamId: string,
  profileId: string,
  activityType = "reading",
) {
  const { rows } = await client.query(
    `insert into public.team_activities
       (team_id, occurred_at, activity_type, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $3, $4, $4)
     returning id`,
    [teamId, "2026-08-18", activityType, profileId],
  );
  return rows[0].id as string;
}

describe("team_activities RLS", () => {
  it("lets a team member insert and another member select their team's activity", async () => {
    await withRollback(async (client) => {
      const { teamId, ownerProfileId, ownerAuthId, teammateAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await insertActivity(client, teamId, ownerProfileId);

      await asClaims(client, { sub: teammateAuthId });
      const { rows } = await client.query(
        "select activity_type from public.team_activities where team_id = $1",
        [teamId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].activity_type).toBe("reading");
    });
  });

  it("does not let a member of another team select the team's activities", async () => {
    await withRollback(async (client) => {
      const { teamId, ownerProfileId, otherAuthId } = await seed(client);
      await insertActivity(client, teamId, ownerProfileId);

      await asClaims(client, { sub: otherAuthId });
      const { rows } = await client.query(
        "select id from public.team_activities where team_id = $1",
        [teamId],
      );
      expect(rows).toHaveLength(0); // RLS filters it out silently, not an error
    });
  });

  it("does not let a member of another team insert an activity for another team", async () => {
    await withRollback(async (client) => {
      const { teamId, otherProfileId, otherAuthId } = await seed(client);

      await asClaims(client, { sub: otherAuthId });
      await expect(
        client.query(
          `insert into public.team_activities
             (team_id, occurred_at, activity_type, created_by_profile_id, updated_by_profile_id)
           values ($1, '2026-08-18', 'Spoof', $2, $2)`,
          [teamId, otherProfileId],
        ),
      ).rejects.toThrow();
    });
  });

  it("lets a team member update and soft-delete (removed_at) their team's activity", async () => {
    await withRollback(async (client) => {
      const { teamId, ownerProfileId, ownerAuthId } = await seed(client);
      const activityId = await insertActivity(client, teamId, ownerProfileId);

      await asClaims(client, { sub: ownerAuthId });
      await client.query(
        `update public.team_activities
           set reflection = 'Uvědomění', updated_by_profile_id = $2
         where id = $1`,
        [activityId, ownerProfileId],
      );
      await client.query(
        `update public.team_activities
           set removed_at = now(), updated_by_profile_id = $2
         where id = $1`,
        [activityId, ownerProfileId],
      );

      const { rows } = await client.query(
        "select reflection, removed_at from public.team_activities where id = $1",
        [activityId],
      );
      expect(rows[0].reflection).toBe("Uvědomění");
      expect(rows[0].removed_at).not.toBeNull();

      const { rows: activeRows } = await client.query(
        "select id from public.team_activities where team_id = $1 and removed_at is null",
        [teamId],
      );
      expect(activeRows).toHaveLength(0); // soft-deleted rows are filtered by the app query
    });
  });

  it("does not let a member of another team update or delete the team's activities", async () => {
    await withRollback(async (client) => {
      const { teamId, ownerProfileId, otherAuthId } = await seed(client);
      const activityId = await insertActivity(client, teamId, ownerProfileId);

      await asClaims(client, { sub: otherAuthId });
      const updateResult = await client.query(
        "update public.team_activities set activity_type = 'Hacked' where id = $1",
        [activityId],
      );
      expect(updateResult.rowCount).toBe(0); // RLS filters the row out

      const deleteResult = await client.query(
        "delete from public.team_activities where id = $1",
        [activityId],
      );
      expect(deleteResult.rowCount).toBe(0);
    });
  });

  it("cascades delete when the team is removed", async () => {
    await withRollback(async (client) => {
      const { teamId, ownerProfileId } = await seed(client);
      await insertActivity(client, teamId, ownerProfileId);

      // no authenticated delete policy on teams, and the profiles update guard
      // blocks regular roles, so simulate an elevated (service_role) session
      await asClaims(client, { role: "service_role" });
      await client.query("delete from public.teams where id = $1", [teamId]);

      const { rows } = await client.query(
        "select count(*)::int as cnt from public.team_activities where team_id = $1",
        [teamId],
      );
      expect(rows[0].cnt).toBe(0);
    });
  });
});
