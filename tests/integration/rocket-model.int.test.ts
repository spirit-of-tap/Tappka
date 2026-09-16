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
     values ('Owner', 'rm-owner@studenti.czu.cz', $1, $2, 'student')
     returning id`,
    [ownerUserRows[0].id, teamId],
  );
  const { rows: teammateProfileRows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ('Teammate', 'rm-team@studenti.czu.cz', $1, $2, 'student')
     returning id`,
    [teammateUserRows[0].id, teamId],
  );
  const { rows: otherProfileRows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ('Other', 'rm-other@studenti.czu.cz', $1, $2, 'student')
     returning id`,
    [otherUserRows[0].id, otherTeamId],
  );

  await client.query("set local role service_role");
  const { rows: categoryRows } = await client.query(
    `insert into public.rocket_categories (code, title, order_index)
     values ('T1', 'Testovací proces', 0)
     returning id`,
  );
  const { rows: itemRows } = await client.query(
    `insert into public.rocket_items (category_id, order_index, text_cs)
     values ($1, 0, 'Každý člen týmu si vede Learning Diary.')
     returning id`,
    [categoryRows[0].id],
  );
  await client.query("reset role");

  return {
    teamId,
    otherTeamId,
    itemId: itemRows[0].id as string,
    ownerProfileId: ownerProfileRows[0].id as string,
    teammateProfileId: teammateProfileRows[0].id as string,
    otherProfileId: otherProfileRows[0].id as string,
    ownerAuthId: ownerAuth.id as string,
    teammateAuthId: teammateAuth.id as string,
    otherAuthId: otherAuth.id as string,
  };
}

describe("rocket_model RLS", () => {
  it("lets any authenticated user read categories and items", async () => {
    await withRollback(async (client) => {
      const { otherAuthId } = await seed(client);

      await asClaims(client, { sub: otherAuthId });
      const { rows: categories } = await client.query(
        "select id from public.rocket_categories where is_active = true",
      );
      const { rows: items } = await client.query(
        "select id from public.rocket_items where is_active = true",
      );
      expect(categories.length).toBeGreaterThan(0);
      expect(items.length).toBeGreaterThan(0);
    });
  });

  it("seeds the 14 reference processes with 71 statements", async () => {
    await withRollback(async (client) => {
      await seed(client);

      const { rows: categories } = await client.query(
        "select code from public.rocket_categories where code <> 'T1' order by order_index",
      );
      const { rows: [{ count: itemCount }] } = await client.query(
        `select count(*) as count from public.rocket_items i
         join public.rocket_categories c on c.id = i.category_id
         where c.code <> 'T1'`,
      );
      expect(categories.map((r) => r.code)).toEqual([
        "Y1", "Y2", "Y3", "J1", "J2", "I1", "I2",
        "B1", "B2", "A3", "A2", "A1", "FIN", "COACH",
      ]);
      expect(Number(itemCount)).toBe(71);
    });
  });

  it("lets a member insert own state and a teammate read it", async () => {
    await withRollback(async (client) => {
      const { itemId, ownerProfileId, ownerAuthId, teammateAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await client.query(
        `insert into public.rocket_individual_states (item_id, profile_id, is_checked)
         values ($1, $2, true)`,
        [itemId, ownerProfileId],
      );

      await asClaims(client, { sub: teammateAuthId });
      const { rows } = await client.query(
        "select is_checked from public.rocket_individual_states where item_id = $1",
        [itemId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].is_checked).toBe(true);
    });
  });

  it("does not let members of other teams read individual states", async () => {
    await withRollback(async (client) => {
      const { itemId, ownerProfileId, ownerAuthId, otherAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await client.query(
        `insert into public.rocket_individual_states (item_id, profile_id, is_checked)
         values ($1, $2, true)`,
        [itemId, ownerProfileId],
      );

      await asClaims(client, { sub: otherAuthId });
      const { rows } = await client.query(
        "select profile_id from public.rocket_individual_states where item_id = $1",
        [itemId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("does not let a member insert a state for someone else", async () => {
    await withRollback(async (client) => {
      const { itemId, teammateProfileId, ownerAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await expect(
        client.query(
          `insert into public.rocket_individual_states (item_id, profile_id, is_checked)
           values ($1, $2, true)`,
          [itemId, teammateProfileId],
        ),
      ).rejects.toThrow();
    });
  });

  it("lets team members manage team checks but blocks other teams", async () => {
    await withRollback(async (client) => {
      const { teamId, itemId, ownerProfileId, teammateProfileId, ownerAuthId, teammateAuthId, otherAuthId } =
        await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await client.query(
        `insert into public.rocket_individual_states (item_id, profile_id, is_checked)
         values ($1, $2, true)`,
        [itemId, ownerProfileId],
      );
      await asClaims(client, { sub: teammateAuthId });
      await client.query(
        `insert into public.rocket_individual_states (item_id, profile_id, is_checked)
         values ($1, $2, true)`,
        [itemId, teammateProfileId],
      );
      await asClaims(client, { sub: ownerAuthId });
      await client.query(
        `insert into public.rocket_team_checks (team_id, item_id, is_checked, checked_by_profile_id)
         values ($1, $2, true, $3)`,
        [teamId, itemId, ownerProfileId],
      );

      await asClaims(client, { sub: otherAuthId });
      const { rows } = await client.query(
        "select team_id from public.rocket_team_checks where team_id = $1",
        [teamId],
      );
      expect(rows).toHaveLength(0);

      await expect(
        client.query(
          `insert into public.rocket_team_checks (team_id, item_id, is_checked, checked_by_profile_id)
           values ($1, $2, true, $3)`,
          [teamId, itemId, ownerProfileId],
        ),
      ).rejects.toThrow();
    });
  });

  it("rejects a team check without unanimous individual states", async () => {
    await withRollback(async (client) => {
      const { teamId, itemId, ownerProfileId, teammateProfileId, ownerAuthId, teammateAuthId } =
        await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await client.query(
        `insert into public.rocket_individual_states (item_id, profile_id, is_checked)
         values ($1, $2, true)`,
        [itemId, ownerProfileId],
      );

      await client.query("SAVEPOINT before_unanimous_check");
      await expect(
        client.query(
          `insert into public.rocket_team_checks (team_id, item_id, is_checked, checked_by_profile_id)
           values ($1, $2, true, $3)`,
          [teamId, itemId, ownerProfileId],
        ),
      ).rejects.toThrow(/every member/i);
      await client.query("ROLLBACK TO SAVEPOINT before_unanimous_check");

      await asClaims(client, { sub: teammateAuthId });
      await client.query(
        `insert into public.rocket_individual_states (item_id, profile_id, is_checked)
         values ($1, $2, true)`,
        [itemId, teammateProfileId],
      );
      await asClaims(client, { sub: ownerAuthId });
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
});
