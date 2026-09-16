import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import type { PoolClient } from "pg";

async function seed(client: PoolClient) {
  const ownerAuth = await insertAuthUser(client);
  const teammateAuth = await insertAuthUser(client);

  const { rows: ownerUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [ownerAuth.id],
  );
  const { rows: teammateUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [teammateAuth.id],
  );

  await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where id = any($1)",
    [[ownerUserRows[0].id, teammateUserRows[0].id]],
  );

  const { rows: teamRows } = await client.query(
    "insert into public.teams (name) values ('Team Former') returning id",
  );
  const teamId = teamRows[0].id as string;

  const { rows: ownerProfileRows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ('Owner', 'tm-owner@studenti.czu.cz', $1, $2, 'student')
     returning id`,
    [ownerUserRows[0].id, teamId],
  );
  const { rows: teammateProfileRows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ('Teammate', 'tm-team@studenti.czu.cz', $1, $2, 'student')
     returning id`,
    [teammateUserRows[0].id, teamId],
  );

  await client.query("set local role service_role");
  const { rows: categoryRows } = await client.query(
    `insert into public.rocket_categories (code, title, order_index)
     values ('TM1', 'Team membership proces', 0)
     returning id`,
  );
  const { rows: itemRows } = await client.query(
    `insert into public.rocket_items (category_id, order_index, text_cs)
     values ($1, 0, 'Kazdy clen tymu pv.')
     returning id`,
    [categoryRows[0].id],
  );
  await client.query("reset role");

  return {
    teamId,
    itemId: itemRows[0].id as string,
    ownerProfileId: ownerProfileRows[0].id as string,
    teammateProfileId: teammateProfileRows[0].id as string,
    ownerAuthId: ownerAuth.id as string,
    teammateAuthId: teammateAuth.id as string,
  };
}

/**
 * Simulates the admin API route: membership changes run through the
 * service-role client (regular authenticated users are blocked from touching
 * team columns by validate_picture_only_update).
 */
async function removeFromTeam(
  client: PoolClient,
  args: { profileId: string; teamId: string; removedBy: string },
): Promise<void> {
  await client.query("set local role service_role");
  await client.query(
    `update public.profiles
     set team_id = null, former_team_id = $2, team_left_at = now(),
         team_removed_by_profile_id = $3
     where id = $1`,
    [args.profileId, args.teamId, args.removedBy],
  );
  await client.query("reset role");
}

describe("team membership removal (former members)", () => {
  it("excludes a removed member from the active roster but keeps the profile visible", async () => {
    await withRollback(async (client) => {
      const { teamId, teammateProfileId, ownerProfileId, ownerAuthId } = await seed(client);

      // Simulate the admin removal: clear team_id, remember the former team.
      await removeFromTeam(client, {
        profileId: teammateProfileId,
        teamId,
        removedBy: ownerProfileId,
      });

      await asClaims(client, { sub: ownerAuthId });

      // Active roster no longer contains the removed member…
      const { rows: active } = await client.query(
        "select id from public.profiles where team_id = $1 and access_removed_at is null",
        [teamId],
      );
      expect(active.map((r) => r.id)).not.toContain(teammateProfileId);

      // …but the profile is still findable for historic reasons.
      const { rows: historic } = await client.query(
        "select id, former_team_id from public.profiles where id = $1 and access_removed_at is null",
        [teammateProfileId],
      );
      expect(historic).toHaveLength(1);
      expect(historic[0].former_team_id).toBe(teamId);

      // …and listed as a former member of the team.
      const { rows: former } = await client.query(
        "select id from public.profiles where former_team_id = $1 and team_id is null and access_removed_at is null",
        [teamId],
      );
      expect(former.map((r) => r.id)).toContain(teammateProfileId);
    });
  });

  it("does not block the rocket team check once a member is removed", async () => {
    await withRollback(async (client) => {
      const { teamId, itemId, ownerProfileId, teammateProfileId, ownerAuthId } =
        await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await client.query(
        `insert into public.rocket_individual_states (item_id, profile_id, is_checked)
         values ($1, $2, true)`,
        [itemId, ownerProfileId],
      );

      // With two active members, a team check must fail…
      await client.query("SAVEPOINT before_removal");
      await expect(
        client.query(
          `insert into public.rocket_team_checks (team_id, item_id, is_checked, checked_by_profile_id)
           values ($1, $2, true, $3)`,
          [teamId, itemId, ownerProfileId],
        ),
      ).rejects.toThrow(/every member/i);
      await client.query("ROLLBACK TO SAVEPOINT before_removal");

      // …after removing the second member it succeeds with unanimity of one.
      await removeFromTeam(client, {
        profileId: teammateProfileId,
        teamId,
        removedBy: ownerProfileId,
      });
      await client.query(
        `insert into public.rocket_team_checks (team_id, item_id, is_checked, checked_by_profile_id)
         values ($1, $2, true, $3)`,
        [teamId, itemId, ownerProfileId],
      );
      const { rows } = await client.query(
        "select is_checked from public.rocket_team_checks where team_id = $1 and item_id = $2",
        [teamId, itemId],
      );
      expect(rows[0].is_checked).toBe(true);
    });
  });

  it("requires unanimity again after a former member is restored", async () => {
    await withRollback(async (client) => {
      const { teamId, teammateProfileId, ownerProfileId, ownerAuthId } = await seed(client);

      await removeFromTeam(client, {
        profileId: teammateProfileId,
        teamId,
        removedBy: ownerProfileId,
      });
      // Restore back into the team.
      await client.query("set local role service_role");
      await client.query(
        `update public.profiles
         set team_id = former_team_id, former_team_id = null, team_left_at = null,
             team_removed_by_profile_id = null
         where id = $1`,
        [teammateProfileId],
      );
      await client.query("reset role");

      await asClaims(client, { sub: ownerAuthId });
      const { rows: active } = await client.query(
        "select id from public.profiles where team_id = $1 and access_removed_at is null",
        [teamId],
      );
      expect(active).toHaveLength(2);
      const { rows: former } = await client.query(
        "select id from public.profiles where former_team_id = $1 and team_id is null",
        [teamId],
      );
      expect(former).toHaveLength(0);
    });
  });

  it("blocks regular users from changing former-team columns", async () => {
    await withRollback(async (client) => {
      const { teamId, ownerProfileId, ownerAuthId } = await seed(client);

      // Own row passes RLS, so only the trigger can reject this.
      await asClaims(client, { sub: ownerAuthId });
      await expect(
        client.query("update public.profiles set former_team_id = $2 where id = $1", [
          ownerProfileId,
          teamId,
        ]),
      ).rejects.toThrow(/Only picture/);
    });
  });
});
