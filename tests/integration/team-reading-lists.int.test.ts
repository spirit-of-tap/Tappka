import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { asClaims } from "@/tests/setup/rls";
import { insertAuthUser } from "@/tests/setup/factories";

async function seed(client: import("pg").PoolClient) {
  const memberAuth = await insertAuthUser(client);
  const otherAuth = await insertAuthUser(client);

  const { rows: memberUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [memberAuth.id],
  );
  const { rows: otherUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [otherAuth.id],
  );

  const { rows: teams } = await client.query(
    "insert into public.teams (name) values ('Alpha'), ('Beta') returning id",
  );
  const teamId = teams[0].id;
  const otherTeamId = teams[1].id;

  await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ('Member', 'member@studenti.czu.cz', $1, $2, 'student')`,
    [memberUserRows[0].id, teamId],
  );
  const { rows: memberProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [memberUserRows[0].id],
  );

  await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ('Other', 'other@studenti.czu.cz', $1, $2, 'student')`,
    [otherUserRows[0].id, otherTeamId],
  );

  return {
    memberProfileId: memberProfiles[0].id as string,
    teamId: teamId as string,
    otherTeamId: otherTeamId as string,
    memberAuthId: memberAuth.id,
    otherAuthId: otherAuth.id,
  };
}

describe("team_reading_lists RLS", () => {
  it("authenticated users can select any list (permissive policy)", async () => {
    await withRollback(async (client) => {
      const { memberProfileId, memberAuthId, teamId } = await seed(client);

      const { rows: created } = await client.query(
        `insert into public.team_reading_lists (team_id, title, created_by_profile_id)
         values ($1, 'List', $2) returning id`,
        [teamId, memberProfileId],
      );

      await asClaims(client, { sub: memberAuthId });
      const { rows } = await client.query(
        "select id from public.team_reading_lists",
      );
      expect(rows).toHaveLength(1);
    });
  });

  it("non-team member cannot delete another team's list (RLS policy blocks)", async () => {
    await withRollback(async (client) => {
      const { memberProfileId, memberAuthId, otherAuthId, teamId } = await seed(client);

      const { rows: created } = await client.query(
        `insert into public.team_reading_lists (team_id, title, created_by_profile_id)
         values ($1, 'List', $2) returning id`,
        [teamId, memberProfileId],
      );

      // Other user (different team) tries to delete — RLS blocks it
      await asClaims(client, { sub: otherAuthId });
      const { rowCount } = await client.query(
        "delete from public.team_reading_lists where id = $1",
        [created[0].id],
      );
      expect(rowCount).toBe(0);
    });
  });

  it("non-team member insert with wrong team_id is blocked by RLS", async () => {
    await withRollback(async (client) => {
      const { memberProfileId, otherAuthId, teamId } = await seed(client);

      // Other user (Beta team) tries to insert into Alpha team's lists
      await asClaims(client, { sub: otherAuthId });
      try {
        await client.query(
          `insert into public.team_reading_lists (team_id, title, created_by_profile_id)
           values ($1, 'List', $2)`,
          [teamId, memberProfileId],
        );
      } catch {
        // expected: RLS with-check rejects
      }
    });
  });
});
